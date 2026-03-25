/**
 * Guest Mode — localStorage-based preferences for non-logged-in users.
 *
 * Stores:
 * - Last questionnaire preferences (so they don't have to re-enter)
 * - Recommendation count (triggers signup prompt after threshold)
 * - Guest favorites (limited to 5, prompts signup for more)
 */

const STORAGE_KEYS = {
  preferences: 'rag_guest_preferences',
  recommendCount: 'rag_guest_recommend_count',
  favorites: 'rag_guest_favorites',
  signupDismissed: 'rag_guest_signup_dismissed',
} as const;

/** Number of recommendations before showing signup prompt */
export const SIGNUP_PROMPT_THRESHOLD = 3;

/** Max favorites for guest users */
export const GUEST_FAVORITES_LIMIT = 5;

// ─── Preferences ─────────────────────────────────────────────

export function getGuestPreferences(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.preferences);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGuestPreferences(prefs: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(prefs));
  } catch {
    // Storage full or disabled
  }
}

export function clearGuestPreferences(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.preferences);
}

// ─── Recommendation Counter ──────────────────────────────────

export function getRecommendCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(STORAGE_KEYS.recommendCount) ?? '0', 10);
  } catch {
    return 0;
  }
}

export function incrementRecommendCount(): number {
  if (typeof window === 'undefined') return 0;
  const count = getRecommendCount() + 1;
  try {
    localStorage.setItem(STORAGE_KEYS.recommendCount, String(count));
  } catch {
    // Storage full or disabled
  }
  return count;
}

// ─── Signup Prompt ───────────────────────────────────────────

export function shouldShowSignupPrompt(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissed = localStorage.getItem(STORAGE_KEYS.signupDismissed);
  if (dismissed === 'true') return false;
  return getRecommendCount() >= SIGNUP_PROMPT_THRESHOLD;
}

export function dismissSignupPrompt(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.signupDismissed, 'true');
}

// ─── Guest Favorites ─────────────────────────────────────────

export function getGuestFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.favorites);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addGuestFavorite(gameId: string): boolean {
  const favorites = getGuestFavorites();
  if (favorites.length >= GUEST_FAVORITES_LIMIT) return false;
  if (favorites.includes(gameId)) return true;
  favorites.push(gameId);
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  } catch {
    return false;
  }
  return true;
}

export function removeGuestFavorite(gameId: string): void {
  const favorites = getGuestFavorites().filter((id) => id !== gameId);
  try {
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  } catch {
    // Storage full or disabled
  }
}

export function isGuestFavorite(gameId: string): boolean {
  return getGuestFavorites().includes(gameId);
}
