"""
Compute hierarchical clustering for the game map visualization.

Builds a 4-level hierarchy tree on top of existing UMAP 2D positions:
  Level 0: root (all games)
  Level 1: ~10 top-level regions (agglomerative clustering of 50 k-means centroids)
  Level 2: ~50 clusters (the original k-means clusters, re-parented)
  Level 3: ~250-300 sub-clusters (HAC within each L2 cluster)
  Level 4: ~1000-1500 leaf clusters (HAC within each L3 cluster)
  Leaves: individual game IDs

Uses GPT-4o-mini to generate evocative names for each cluster based on
the games, categories, and mechanics inside it.

Usage:
  python3 scripts/compute-map-hierarchy.py
  python3 scripts/compute-map-hierarchy.py --skip-llm   # clustering only, placeholder labels

Requires: pip3 install scipy scikit-learn numpy requests openai
Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import requests
from pathlib import Path
from collections import Counter, defaultdict
from scipy.cluster.hierarchy import linkage, fcluster
from openai import OpenAI

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent

# Load .env.local
env_path = PROJECT_DIR / '.env.local'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, _, val = line.partition('=')
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

SUPABASE_URL = os.environ['NEXT_PUBLIC_SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
}

L1_COUNT = 10   # top-level clusters
L3_PER_L2 = 6   # sub-clusters per L2
L4_PER_L3 = 5   # leaf clusters per L3

# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------

def supabase_get(path, params=None):
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{path}', headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()

def fetch_all_paginated(table, select, extra_params=None, page_size=1000):
    all_rows = []
    offset = 0
    while True:
        params = {'select': select, 'order': 'id', 'offset': offset, 'limit': page_size}
        if extra_params:
            params.update(extra_params)
        # Retry with backoff for rate limits
        for attempt in range(8):
            try:
                rows = supabase_get(table, params)
                break
            except Exception as e:
                if attempt < 7:
                    wait = min(2 ** attempt, 30)
                    print(f"  [Retry] {e}, waiting {wait}s...")
                    time.sleep(wait)
                else:
                    raise
        if not rows:
            break
        all_rows.extend(rows)
        offset += page_size
        if offset % 5000 == 0:
            print(f"  ... fetched {len(all_rows)} rows")
        if len(rows) < page_size:
            break
        time.sleep(0.1)  # small delay between pages
    return all_rows

# ---------------------------------------------------------------------------
# Phase 1: Build hierarchy structure
# ---------------------------------------------------------------------------

def build_hierarchy(positions, clusters_50):
    """Build a 4-level hierarchy tree from existing UMAP positions + k-means clusters."""

    # Index positions by cluster ID
    cluster_games = defaultdict(list)
    game_positions = {}
    for p in positions:
        cluster_games[p['c']].append(p['id'])
        game_positions[p['id']] = (p['x'], p['y'])

    hierarchy = {}

    # --- Level 1: Agglomerate the 50 centroids into ~10 top-level groups ---
    centroids = np.array([[c['cx'], c['cy']] for c in clusters_50])
    Z_top = linkage(centroids, method='ward')
    l1_labels = fcluster(Z_top, t=L1_COUNT, criterion='maxclust')

    # Map: L2 cluster ID -> L1 group ID
    l2_to_l1 = {}
    l1_children = defaultdict(list)
    for i, c in enumerate(clusters_50):
        l1_id = int(l1_labels[i]) - 1  # 0-indexed
        l2_to_l1[c['id']] = l1_id
        l1_children[l1_id].append(f"L2-{c['id']}")

    # Create L1 nodes
    for l1_id in range(L1_COUNT):
        child_l2_ids = [int(cid.split('-')[1]) for cid in l1_children[l1_id]]
        all_game_ids = []
        for l2_id in child_l2_ids:
            all_game_ids.extend(cluster_games[l2_id])

        positions_arr = np.array([game_positions[gid] for gid in all_game_ids])
        cx, cy = float(positions_arr[:, 0].mean()), float(positions_arr[:, 1].mean())
        dists = np.sqrt((positions_arr[:, 0] - cx)**2 + (positions_arr[:, 1] - cy)**2)
        radius = float(dists.max()) * 1.1

        hierarchy[f"L1-{l1_id}"] = {
            'id': f"L1-{l1_id}",
            'level': 1,
            'label': f"Region {l1_id}",  # placeholder
            'cx': round(cx, 1),
            'cy': round(cy, 1),
            'radius': round(radius, 1),
            'count': len(all_game_ids),
            'colorIndex': l1_id % 12,
            'children': l1_children[l1_id],
            'parentId': 'root',
        }

    # Create L2 nodes (the original 50 clusters)
    for c in clusters_50:
        l1_id = l2_to_l1[c['id']]
        game_ids = cluster_games[c['id']]
        if not game_ids:
            continue

        positions_arr = np.array([game_positions[gid] for gid in game_ids])
        cx, cy = float(positions_arr[:, 0].mean()), float(positions_arr[:, 1].mean())
        dists = np.sqrt((positions_arr[:, 0] - cx)**2 + (positions_arr[:, 1] - cy)**2)
        radius = float(dists.max()) * 1.1 if len(game_ids) > 1 else 50.0

        hierarchy[f"L2-{c['id']}"] = {
            'id': f"L2-{c['id']}",
            'level': 2,
            'label': c['label'],  # will be overwritten by LLM
            'cx': round(cx, 1),
            'cy': round(cy, 1),
            'radius': round(radius, 1),
            'count': len(game_ids),
            'colorIndex': l1_id % 12,
            'children': [],  # filled by L3
            'parentId': f"L1-{l1_id}",
        }

    # --- Level 3 & 4: Sub-cluster within each L2 cluster ---
    l3_counter = 0
    l4_counter = 0

    for c in clusters_50:
        game_ids = cluster_games[c['id']]
        if len(game_ids) < 2:
            # Too small to sub-cluster, make a single L3 -> L4 with game leaves
            l3_id = f"L3-{l3_counter}"
            l3_counter += 1
            l4_id = f"L4-{l4_counter}"
            l4_counter += 1

            pos = np.array([game_positions[gid] for gid in game_ids])
            cx, cy = float(pos[:, 0].mean()), float(pos[:, 1].mean())

            hierarchy[l3_id] = {
                'id': l3_id, 'level': 3, 'label': f"Cluster {l3_id}",
                'cx': round(cx, 1), 'cy': round(cy, 1), 'radius': 50.0,
                'count': len(game_ids),
                'colorIndex': hierarchy[f"L2-{c['id']}"]['colorIndex'],
                'children': [l4_id], 'parentId': f"L2-{c['id']}",
            }
            hierarchy[l4_id] = {
                'id': l4_id, 'level': 4, 'label': f"Cluster {l4_id}",
                'cx': round(cx, 1), 'cy': round(cy, 1), 'radius': 50.0,
                'count': len(game_ids),
                'colorIndex': hierarchy[f"L2-{c['id']}"]['colorIndex'],
                'children': game_ids, 'parentId': l3_id,
            }
            hierarchy[f"L2-{c['id']}"]['children'].append(l3_id)
            continue

        # Get positions for this cluster's games
        pts = np.array([game_positions[gid] for gid in game_ids])
        color_idx = hierarchy[f"L2-{c['id']}"]['colorIndex']

        # Determine L3 count based on cluster size
        n_l3 = min(L3_PER_L2, max(2, len(game_ids) // 80))

        if len(game_ids) <= n_l3:
            # Fewer games than target clusters -- just one L3
            n_l3 = 1

        if n_l3 == 1:
            l3_groups = {0: list(range(len(game_ids)))}
        else:
            Z_l3 = linkage(pts, method='ward')
            l3_labels = fcluster(Z_l3, t=n_l3, criterion='maxclust')
            l3_groups = defaultdict(list)
            for idx, lab in enumerate(l3_labels):
                l3_groups[int(lab) - 1].append(idx)

        l2_l3_children = []

        for l3_group_id, indices in l3_groups.items():
            l3_id = f"L3-{l3_counter}"
            l3_counter += 1
            l3_game_ids = [game_ids[i] for i in indices]
            l3_pts = pts[indices]

            cx3 = float(l3_pts[:, 0].mean())
            cy3 = float(l3_pts[:, 1].mean())
            dists3 = np.sqrt((l3_pts[:, 0] - cx3)**2 + (l3_pts[:, 1] - cy3)**2)
            radius3 = float(dists3.max()) * 1.1 if len(l3_game_ids) > 1 else 50.0

            # Sub-cluster L3 into L4
            n_l4 = min(L4_PER_L3, max(2, len(l3_game_ids) // 15))
            if len(l3_game_ids) <= n_l4:
                n_l4 = 1

            l3_l4_children = []

            if n_l4 == 1 or len(l3_game_ids) < 3:
                # Single L4 leaf cluster
                l4_id = f"L4-{l4_counter}"
                l4_counter += 1
                hierarchy[l4_id] = {
                    'id': l4_id, 'level': 4, 'label': f"Cluster {l4_id}",
                    'cx': round(cx3, 1), 'cy': round(cy3, 1),
                    'radius': round(radius3, 1),
                    'count': len(l3_game_ids),
                    'colorIndex': color_idx,
                    'children': l3_game_ids,
                    'parentId': l3_id,
                }
                l3_l4_children.append(l4_id)
            else:
                Z_l4 = linkage(l3_pts, method='ward')
                l4_labels = fcluster(Z_l4, t=n_l4, criterion='maxclust')
                l4_groups = defaultdict(list)
                for idx, lab in enumerate(l4_labels):
                    l4_groups[int(lab) - 1].append(idx)

                for l4_group_id, l4_indices in l4_groups.items():
                    l4_id = f"L4-{l4_counter}"
                    l4_counter += 1
                    l4_game_ids = [l3_game_ids[i] for i in l4_indices]
                    l4_pts = l3_pts[l4_indices]

                    cx4 = float(l4_pts[:, 0].mean())
                    cy4 = float(l4_pts[:, 1].mean())
                    dists4 = np.sqrt((l4_pts[:, 0] - cx4)**2 + (l4_pts[:, 1] - cy4)**2)
                    radius4 = float(dists4.max()) * 1.1 if len(l4_game_ids) > 1 else 30.0

                    hierarchy[l4_id] = {
                        'id': l4_id, 'level': 4, 'label': f"Cluster {l4_id}",
                        'cx': round(cx4, 1), 'cy': round(cy4, 1),
                        'radius': round(radius4, 1),
                        'count': len(l4_game_ids),
                        'colorIndex': color_idx,
                        'children': l4_game_ids,
                        'parentId': l3_id,
                    }
                    l3_l4_children.append(l4_id)

            hierarchy[l3_id] = {
                'id': l3_id, 'level': 3, 'label': f"Cluster {l3_id}",
                'cx': round(cx3, 1), 'cy': round(cy3, 1),
                'radius': round(radius3, 1),
                'count': len(l3_game_ids),
                'colorIndex': color_idx,
                'children': l3_l4_children,
                'parentId': f"L2-{c['id']}",
            }
            l2_l3_children.append(l3_id)

        hierarchy[f"L2-{c['id']}"]['children'] = l2_l3_children

    # Root node
    hierarchy['root'] = {
        'id': 'root',
        'level': 0,
        'label': 'All Games',
        'cx': 5000.0,
        'cy': 5000.0,
        'radius': 5500.0,
        'count': len(positions),
        'colorIndex': -1,
        'children': [f"L1-{i}" for i in range(L1_COUNT)],
        'parentId': None,
    }

    return hierarchy

# ---------------------------------------------------------------------------
# Phase 2: LLM naming
# ---------------------------------------------------------------------------

def fetch_game_metadata(needed_ids):
    """Fetch name, categories, mechanics for games from Supabase.
    Only fetches games we actually need (those in the hierarchy)."""
    print(f"[Hierarchy] Fetching game metadata from Supabase ({len(needed_ids)} games needed)...")

    # Fetch all non-expansion games (we need categories/mechanics for clustering labels)
    # Use batched IN queries if Supabase is flaky, but paginated fetch is usually fine
    meta = {}
    rows = fetch_all_paginated('games', 'id,name,categories,mechanics', {
        'is_expansion': 'eq.false',
    })
    for r in rows:
        meta[r['id']] = {
            'name': r.get('name', ''),
            'categories': r.get('categories') or [],
            'mechanics': r.get('mechanics') or [],
        }

    # If we couldn't fetch all, try fetching in smaller batches for missing IDs
    missing = needed_ids - set(meta.keys())
    if missing:
        print(f"  [Meta] {len(missing)} games missing, fetching in batches...")
        missing_list = sorted(missing)
        for batch_start in range(0, len(missing_list), 100):
            batch = missing_list[batch_start:batch_start + 100]
            ids_csv = ','.join(f'"{gid}"' for gid in batch)
            try:
                rows = supabase_get('games', {
                    'select': 'id,name,categories,mechanics',
                    'id': f'in.({ids_csv})',
                })
                for r in rows:
                    meta[r['id']] = {
                        'name': r.get('name', ''),
                        'categories': r.get('categories') or [],
                        'mechanics': r.get('mechanics') or [],
                    }
            except Exception as e:
                print(f"  [Meta] Batch fetch error: {e}")
            time.sleep(0.2)

    found = len(needed_ids & set(meta.keys()))
    print(f"[Hierarchy] Fetched metadata for {len(meta)} games ({found}/{len(needed_ids)} needed)")
    return meta


def name_clusters_with_llm(hierarchy, game_meta, cache_path):
    """Use GPT-4o-mini to generate evocative cluster names, bottom-up."""
    client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

    # Load cache
    cache = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
        print(f"[LLM] Loaded {len(cache)} cached labels")

    def get_cluster_context(node_id):
        """Build context string for a cluster based on its games."""
        node = hierarchy[node_id]
        if node['level'] == 4:
            # Leaf cluster: use game names + categories + mechanics
            game_ids = node['children']
            names = []
            all_cats = []
            all_mechs = []
            for gid in game_ids[:15]:  # sample up to 15
                if gid in game_meta:
                    names.append(game_meta[gid]['name'])
                    all_cats.extend(game_meta[gid]['categories'])
                    all_mechs.extend(game_meta[gid]['mechanics'])
            top_cats = [c for c, _ in Counter(all_cats).most_common(4)]
            top_mechs = [m for m, _ in Counter(all_mechs).most_common(4)]
            return {
                'games': names,
                'categories': top_cats,
                'mechanics': top_mechs,
                'count': node['count'],
            }
        else:
            # Non-leaf: use child labels
            child_labels = [hierarchy[cid]['label'] for cid in node['children'] if cid in hierarchy]
            return {
                'sub_clusters': child_labels,
                'count': node['count'],
            }

    # Level-specific naming instructions
    LEVEL_PROMPTS = {
        4: """You are labeling clusters on a board game map. Each cluster contains ~20 specific games.
Give each cluster a SHORT, FACTUAL label (2-4 words) describing what the games have in common.
Use real board game terminology: actual mechanic names, theme descriptors, or genre terms.
Think like a game store shelf label or BGG category. Examples: "Trick-Taking Cards", "Sci-Fi Dungeon Crawls", "Abstract Two-Player", "WWII Hex Wargames".
NEVER use flowery/creative language. NEVER use words like: realm, odyssey, haven, wonderland, saga, quest, frontier, domain, chronicles.""",

        3: """You are labeling sub-sections on a board game map. Each section contains a few related clusters.
Give each a SHORT, FACTUAL label (2-3 words) describing the common theme or mechanic.
Use standard board gaming vocabulary. Examples: "Worker Placement", "Area Control", "Cooperative Horror", "Economic Sims", "Dexterity Games".
NEVER use flowery/creative language. NEVER use words like: realm, odyssey, haven, wonderland, saga, quest, frontier, domain, chronicles.""",

        2: """You are labeling regions on a board game map. Each region is a broad grouping.
Give each a SHORT, FACTUAL label (1-3 words) that a board gamer would recognize instantly.
Examples: "Euro Strategy", "Party Games", "Wargames", "Family Games", "Card Games", "Abstract Games", "Thematic Adventures".
Be BORING and ACCURATE. This is a map legend, not marketing copy.""",

        1: """You are labeling the top-level sections of a board game map. These are the broadest categories.
Give each a SINGLE-WORD or TWO-WORD label that describes a major genre of board games.
Examples: "Strategy", "Party", "Wargames", "Family", "Card Games", "Thematic", "Abstract", "Kids", "Cooperative".
Be as generic and recognizable as possible. A non-gamer should understand these labels.""",
    }

    def batch_name(node_ids, level_desc, level):
        """Name a batch of clusters via a single LLM call."""
        # Filter out cached ones
        uncached = [nid for nid in node_ids if nid not in cache]
        if not uncached:
            for nid in node_ids:
                hierarchy[nid]['label'] = cache[nid]
            return

        batch_size = 20
        for batch_start in range(0, len(uncached), batch_size):
            batch = uncached[batch_start:batch_start + batch_size]
            cluster_descs = []
            for i, nid in enumerate(batch):
                ctx = get_cluster_context(nid)
                if 'games' in ctx:
                    desc = f"Cluster {i+1} ({ctx['count']} games): Games: {', '.join(ctx['games'][:10])}. Categories: {', '.join(ctx['categories'])}. Mechanics: {', '.join(ctx['mechanics'])}."
                else:
                    desc = f"Cluster {i+1} ({ctx['count']} games): Contains sub-sections: {', '.join(ctx['sub_clusters'])}."
                cluster_descs.append(desc)

            system = LEVEL_PROMPTS.get(level, LEVEL_PROMPTS[4])
            prompt = f"""{system}

{chr(10).join(cluster_descs)}

Respond as JSON array: [{{"id": 1, "name": "..."}}]"""

            try:
                resp = client.chat.completions.create(
                    model='gpt-4o-mini',
                    messages=[{'role': 'user', 'content': prompt}],
                    response_format={'type': 'json_object'},
                    temperature=0.7,
                )
                content = resp.choices[0].message.content
                parsed = json.loads(content)
                # Handle both {"clusters": [...]} and [...] formats
                if isinstance(parsed, dict):
                    items = parsed.get('clusters', parsed.get('names', parsed.get('result', [])))
                    if not items:
                        # Try first list value in the dict
                        for v in parsed.values():
                            if isinstance(v, list):
                                items = v
                                break
                else:
                    items = parsed

                for item in items:
                    idx = item['id'] - 1
                    if 0 <= idx < len(batch):
                        nid = batch[idx]
                        name = item['name']
                        hierarchy[nid]['label'] = name
                        cache[nid] = name

                print(f"  [LLM] Named {len(items)} {level_desc} clusters (batch {batch_start // batch_size + 1})")
            except Exception as e:
                print(f"  [LLM] Error naming batch: {e}")
                # Use placeholder for failed ones
                for nid in batch:
                    if nid not in cache:
                        hierarchy[nid]['label'] = f"Games ({hierarchy[nid]['count']})"
                        cache[nid] = hierarchy[nid]['label']

            time.sleep(0.3)  # rate limit

        # Apply cached labels to all nodes (including pre-cached ones)
        for nid in node_ids:
            if nid in cache:
                hierarchy[nid]['label'] = cache[nid]

    # Name bottom-up: L4 -> L3 -> L2 -> L1
    l4_ids = [nid for nid, n in hierarchy.items() if n['level'] == 4]
    l3_ids = [nid for nid, n in hierarchy.items() if n['level'] == 3]
    l2_ids = [nid for nid, n in hierarchy.items() if n['level'] == 2]
    l1_ids = [nid for nid, n in hierarchy.items() if n['level'] == 1]

    print(f"[LLM] Naming {len(l4_ids)} L4 clusters...")
    batch_name(l4_ids, 'L4', 4)

    print(f"[LLM] Naming {len(l3_ids)} L3 clusters...")
    batch_name(l3_ids, 'L3', 3)

    print(f"[LLM] Naming {len(l2_ids)} L2 clusters...")
    batch_name(l2_ids, 'L2', 2)

    print(f"[LLM] Naming {len(l1_ids)} L1 clusters...")
    batch_name(l1_ids, 'L1', 1)

    # Save cache
    cache_path.write_text(json.dumps(cache, indent=2))
    print(f"[LLM] Saved {len(cache)} labels to cache")

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_hierarchy(hierarchy, positions):
    """Run assertions to verify tree integrity."""
    game_ids_from_positions = {p['id'] for p in positions}

    # Collect all leaf game IDs from L4 nodes
    leaf_game_ids = set()
    for nid, node in hierarchy.items():
        if node['level'] == 4:
            for gid in node['children']:
                assert gid not in leaf_game_ids, f"Duplicate leaf: {gid} in {nid}"
                leaf_game_ids.add(gid)

    # Every game in positions should be a leaf
    missing = game_ids_from_positions - leaf_game_ids
    extra = leaf_game_ids - game_ids_from_positions
    assert not missing, f"{len(missing)} games missing from hierarchy: {list(missing)[:5]}"
    assert not extra, f"{len(extra)} extra games in hierarchy: {list(extra)[:5]}"

    # Every non-root node has a parent that exists
    for nid, node in hierarchy.items():
        if nid == 'root':
            assert node['parentId'] is None
            continue
        assert node['parentId'] in hierarchy, f"Node {nid} has missing parent {node['parentId']}"

    # Every child reference exists
    for nid, node in hierarchy.items():
        for cid in node['children']:
            if node['level'] < 4:
                assert cid in hierarchy, f"Node {nid} has missing child {cid}"

    # Level counts
    counts_by_level = Counter(n['level'] for n in hierarchy.values())
    print(f"\n[Validate] Node counts by level:")
    for level in sorted(counts_by_level):
        print(f"  Level {level}: {counts_by_level[level]} nodes")
    print(f"  Leaf games: {len(leaf_game_ids)}")

    # Centroids in bounds
    for nid, node in hierarchy.items():
        assert 0 <= node['cx'] <= 10000, f"Node {nid} cx={node['cx']} out of bounds"
        assert 0 <= node['cy'] <= 10000, f"Node {nid} cy={node['cy']} out of bounds"

    print("[Validate] All assertions passed!")

# ---------------------------------------------------------------------------
# Print tree summary
# ---------------------------------------------------------------------------

def print_tree_summary(hierarchy):
    """Print a readable tree for manual review."""
    def print_node(nid, depth=0):
        node = hierarchy[nid]
        indent = '  ' * depth
        suffix = f" ({node['count']} games, r={node['radius']:.0f})" if node['level'] < 4 else f" ({node['count']} games)"
        print(f"{indent}{node['label']}{suffix}")
        if node['level'] < 4:
            for cid in node['children'][:6]:  # limit output
                if cid in hierarchy:
                    print_node(cid, depth + 1)
            if len(node['children']) > 6:
                print(f"{indent}  ... and {len(node['children']) - 6} more")

    print("\n[Tree Summary]")
    print_node('root')

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-llm', action='store_true', help='Skip LLM naming, use placeholder labels')
    args = parser.parse_args()

    # Load existing data
    positions_path = SCRIPT_DIR / 'map-positions.json'
    clusters_path = SCRIPT_DIR / 'map-clusters.json'

    print("[Hierarchy] Loading existing UMAP positions...")
    positions = json.loads(positions_path.read_text())
    print(f"[Hierarchy] Loaded {len(positions)} game positions")

    print("[Hierarchy] Loading existing k-means clusters...")
    clusters_50 = json.loads(clusters_path.read_text())
    print(f"[Hierarchy] Loaded {len(clusters_50)} clusters")

    # Phase 1: Build hierarchy
    print("\n[Hierarchy] Building 4-level hierarchy...")
    hierarchy = build_hierarchy(positions, clusters_50)

    # Validate before naming
    print("\n[Hierarchy] Validating tree structure...")
    validate_hierarchy(hierarchy, positions)

    # Phase 2: LLM naming
    if not args.skip_llm:
        needed_ids = {p['id'] for p in positions}
        game_meta = fetch_game_metadata(needed_ids)
        cache_path = SCRIPT_DIR / 'map-hierarchy-labels-cache.json'
        name_clusters_with_llm(hierarchy, game_meta, cache_path)
    else:
        print("[Hierarchy] Skipping LLM naming (--skip-llm)")

    # Print summary
    print_tree_summary(hierarchy)

    # Save
    output_path = SCRIPT_DIR / 'map-hierarchy.json'
    output = {
        'meta': {
            'gameCount': len(positions),
            'levels': 5,
            'generated': time.strftime('%Y-%m-%dT%H:%M:%S'),
        },
        'nodes': hierarchy,
    }
    output_path.write_text(json.dumps(output))
    size_kb = output_path.stat().st_size // 1024
    print(f"\n[Hierarchy] Saved hierarchy to {output_path} ({size_kb} KB)")
    print("[Hierarchy] Done! Now run: npx tsx scripts/export-map-data.ts")

if __name__ == '__main__':
    main()
