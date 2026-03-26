/**
 * Display formatting utilities.
 *
 * Converts internal data values into human-readable labels.
 */

const GAME_TYPE_LABELS: Record<string, string> = {
  board: 'Board Game',
  video: 'Video Game',
  word: 'Word Game',
  party: 'Party Game',
  card: 'Card Game',
  expansion: 'Expansion',
  local: 'Word Game',
};

/**
 * Formats a game type slug into a human-readable label.
 * "board" → "Board Game", "video" → "Video Game", etc.
 */
export function formatGameType(type: string): string {
  return GAME_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
