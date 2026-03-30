/**
 * Steam User Library Fetcher
 *
 * Fetches a Steam user's owned games via the Steam Web API.
 * Requires STEAM_API_KEY environment variable.
 *
 * Two-step process:
 * 1. Resolve vanity URL to Steam64 ID (if needed)
 * 2. Fetch owned games via IPlayerService/GetOwnedGames
 */

const STEAM_API_BASE = 'https://api.steampowered.com';

export interface SteamOwnedGame {
  appId: number;
  name: string;
  playtimeMinutes: number;
  iconUrl: string | null;
}

/**
 * Resolve a Steam vanity URL (custom profile name) to a Steam64 ID.
 * Input can be:
 * - A Steam64 ID (17-digit number) -- returned as-is
 * - A vanity name (e.g., "gaben")
 * - A full profile URL (e.g., "https://steamcommunity.com/id/gaben")
 */
export async function resolveSteamId(input: string): Promise<string | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;

  // Clean up input
  let vanity = input.trim();

  // Extract from full URLs
  const idMatch = vanity.match(/steamcommunity\.com\/(?:id|profiles)\/([^/]+)/);
  if (idMatch) vanity = idMatch[1];

  // If it's already a 17-digit Steam64 ID, return as-is
  if (/^\d{17}$/.test(vanity)) return vanity;

  // Resolve vanity URL
  const url = `${STEAM_API_BASE}/ISteamUser/ResolveVanityURL/v0001/?key=${apiKey}&vanityurl=${encodeURIComponent(vanity)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response?.success === 1 && data.response.steamid) {
      return data.response.steamid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a Steam user's owned games.
 * Returns null if the profile is private or the API key is missing.
 */
export async function fetchSteamLibrary(
  steamId: string,
): Promise<SteamOwnedGame[] | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;

  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&include_appinfo=1&format=json`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const games = data.response?.games;
    if (!Array.isArray(games)) return null;

    return games.map((g: { appid: number; name: string; playtime_forever: number; img_icon_url: string }) => ({
      appId: g.appid,
      name: g.name,
      playtimeMinutes: g.playtime_forever ?? 0,
      iconUrl: g.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`
        : null,
    }));
  } catch {
    return null;
  }
}
