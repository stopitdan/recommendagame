"""
Compute 2D map positions for all games using UMAP dimensionality reduction.

Takes the 768-dim attribute embeddings from game_embeddings (via Supabase REST API),
projects them to 2D via UMAP, clusters with k-means, and writes map_x/map_y/map_cluster_id
back to the games table.

Usage:
  python3 scripts/compute-map-positions.py

Requires: pip3 install umap-learn scikit-learn numpy requests
Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""

import os
import json
import numpy as np
import requests
from pathlib import Path
from collections import Counter

# Load .env.local
env_path = Path(__file__).parent.parent / '.env.local'
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
    'Prefer': 'return=minimal',
}

def supabase_get(path, params=None):
    """GET from Supabase REST API."""
    r = requests.get(f'{SUPABASE_URL}/rest/v1/{path}', headers=HEADERS, params=params)
    r.raise_for_status()
    return r.json()

def supabase_patch(path, data, params=None):
    """PATCH to Supabase REST API."""
    r = requests.patch(f'{SUPABASE_URL}/rest/v1/{path}', headers=HEADERS, json=data, params=params)
    r.raise_for_status()

# ─── Main ─────────────────────────────────────────────────

def main():
    from umap import UMAP
    from sklearn.cluster import KMeans

    # Step 1: Fetch all embeddings (paginated)
    print("[Map] Fetching embeddings from Supabase...")
    all_rows = []
    offset = 0
    page_size = 1000

    while True:
        rows = supabase_get('game_embeddings', {
            'select': 'game_id,embedding',
            'embedding': 'not.is.null',
            'order': 'game_id',
            'offset': offset,
            'limit': page_size,
        })
        if not rows:
            break
        all_rows.extend(rows)
        offset += page_size
        print(f"  ... fetched {len(all_rows)} embeddings")

    print(f"[Map] Total embeddings: {len(all_rows)}")
    if len(all_rows) < 100:
        print("[Map] Not enough embeddings. Aborting.")
        return

    # Step 2: Filter to non-expansion games
    print("[Map] Fetching expansion game IDs to exclude...")
    expansion_ids = set()
    offset = 0
    while True:
        rows = supabase_get('games', {
            'select': 'id',
            'is_expansion': 'eq.true',
            'offset': offset,
            'limit': page_size,
        })
        if not rows:
            break
        expansion_ids.update(r['id'] for r in rows)
        offset += page_size

    print(f"[Map] Excluding {len(expansion_ids)} expansions")

    # Parse embeddings
    game_ids = []
    vectors = []
    for row in all_rows:
        gid = row['game_id']
        if gid in expansion_ids:
            continue
        emb = row['embedding']
        if isinstance(emb, str):
            vec = json.loads(emb)
        elif isinstance(emb, list):
            vec = emb
        else:
            continue
        game_ids.append(gid)
        vectors.append(np.array(vec, dtype=np.float32))

    X = np.vstack(vectors)
    print(f"[Map] Matrix shape: {X.shape} ({len(game_ids)} games)")

    # Step 3: UMAP
    print("[Map] Running UMAP (this takes a few minutes)...")
    reducer = UMAP(
        n_components=2,
        n_neighbors=15,
        min_dist=0.1,
        metric='cosine',
        random_state=42,
        verbose=True,
    )
    coords_2d = reducer.fit_transform(X)
    print(f"[Map] UMAP complete. Shape: {coords_2d.shape}")

    # Normalize to [0, 10000]
    for dim in range(2):
        mn, mx = coords_2d[:, dim].min(), coords_2d[:, dim].max()
        coords_2d[:, dim] = (coords_2d[:, dim] - mn) / (mx - mn) * 10000

    # Step 4: K-Means clustering
    n_clusters = 50
    print(f"[Map] Running k-means with {n_clusters} clusters...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_ids = kmeans.fit_predict(coords_2d)

    # Step 5: Save UMAP results to a JSON file for fast batch upload
    # (Writing 32k individual REST PATCHes is too slow; the export script
    # reads directly from this file instead)
    print("[Map] Saving UMAP positions to file...")
    positions = []
    for j in range(len(game_ids)):
        positions.append({
            'id': game_ids[j],
            'x': round(float(coords_2d[j, 0]), 2),
            'y': round(float(coords_2d[j, 1]), 2),
            'c': int(cluster_ids[j]),
        })

    positions_path = Path(__file__).parent / 'map-positions.json'
    positions_path.write_text(json.dumps(positions))
    print(f"[Map] Saved {len(positions)} positions to {positions_path}")

    # Also write to DB in parallel batches via REST
    print("[Map] Writing positions to database (this may take a while)...")
    updated = 0
    for pos in positions:
        try:
            supabase_patch('games', {'map_x': pos['x'], 'map_y': pos['y'], 'map_cluster_id': pos['c']}, {'id': f'eq.{pos["id"]}'})
            updated += 1
        except Exception as e:
            pass  # Silent fail, we have the JSON file as backup

        if updated % 1000 == 0:
            print(f"  ... {updated}/{len(positions)} games updated")

    print(f"[Map] Updated {updated} games.")

    # Step 6: Compute cluster metadata
    print("[Map] Computing cluster metadata...")

    # Fetch categories/types for games with positions
    game_meta = {}
    offset = 0
    while True:
        rows = supabase_get('games', {
            'select': 'id,categories,types',
            'map_cluster_id': 'not.is.null',
            'offset': offset,
            'limit': page_size,
        })
        if not rows:
            break
        for r in rows:
            game_meta[r['id']] = {'categories': r.get('categories') or [], 'types': r.get('types') or []}
        offset += page_size

    cluster_info = []
    for cid in range(n_clusters):
        mask = cluster_ids == cid
        if not mask.any():
            continue

        cx = round(float(coords_2d[mask, 0].mean()), 1)
        cy = round(float(coords_2d[mask, 1].mean()), 1)
        count = int(mask.sum())

        all_cats = []
        all_types = []
        for idx in np.where(mask)[0]:
            gid = game_ids[idx]
            if gid in game_meta:
                all_cats.extend(game_meta[gid]['categories'])
                all_types.extend(game_meta[gid]['types'])

        top_cat = Counter(all_cats).most_common(1)
        top_type = Counter(all_types).most_common(1)

        cluster_info.append({
            'id': int(cid),
            'cx': cx,
            'cy': cy,
            'label': top_cat[0][0] if top_cat else 'Games',
            'primaryType': top_type[0][0] if top_type else 'board',
            'count': count,
        })

    cluster_path = Path(__file__).parent / 'map-clusters.json'
    cluster_path.write_text(json.dumps(cluster_info, indent=2))
    print(f"[Map] Saved {len(cluster_info)} clusters to {cluster_path}")

    print("\n[Map] Done! Now run: npx tsx scripts/export-map-data.ts")

if __name__ == '__main__':
    main()
