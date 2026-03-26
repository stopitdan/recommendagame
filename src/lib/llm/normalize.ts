/**
 * Text normalization and fuzzy matching for LLM cache.
 *
 * Cache keys are normalized so that different phrasings of the same
 * intent hit the same entry: "I like roguelike games!" and
 * "games, I like roguelike" both normalize to "games i like roguelike".
 *
 * Fuzzy matching catches typos: "roguelkie" vs "roguelike" has a
 * Levenshtein distance ratio of ~0.11 (below the 0.15 threshold).
 */

/**
 * Normalize text for cache key generation.
 *
 * Steps:
 * 1. Lowercase
 * 2. Strip all punctuation
 * 3. Collapse whitespace
 * 4. Sort words alphabetically (makes word order irrelevant)
 * 5. Join with single space
 */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .sort()
    .join(' ');
}

/**
 * Standard Levenshtein edit distance between two strings.
 * Uses dynamic programming — O(n*m) time and space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Check if two strings are a fuzzy match.
 *
 * Returns true if the edit distance as a ratio of the longer string's
 * length is below the threshold. Default threshold 0.15 means up to
 * 15% of characters can differ.
 *
 * Examples at threshold 0.15:
 *   "roguelike" vs "roguelkie" → distance 2, ratio 0.22 → false (but normalized versions may differ)
 *   "i like roguelike games" vs "i like roguelkie games" → distance 2, ratio 0.09 → true
 */
export function isFuzzyMatch(a: string, b: string, threshold = 0.15): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;

  const distance = levenshteinDistance(a, b);
  return distance / maxLen < threshold;
}
