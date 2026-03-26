/**
 * IGDB API response types.
 *
 * IGDB (Internet Game Database) uses Twitch OAuth2 for auth
 * and an Apicalypse query language for requests.
 *
 * API docs: https://api-docs.igdb.com/
 */

export interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  storyline?: string;
  url?: string;
  first_release_date?: number; // Unix timestamp
  total_rating?: number; // 0-100 scale
  total_rating_count?: number;
  aggregated_rating?: number; // 0-100 (critic)
  rating?: number; // 0-100 (user)
  rating_count?: number;
  genres?: IgdbGenre[];
  themes?: IgdbTheme[];
  game_modes?: IgdbGameMode[];
  platforms?: IgdbPlatform[];
  player_perspectives?: IgdbPlayerPerspective[];
  keywords?: IgdbKeyword[];
  involved_companies?: IgdbInvolvedCompany[];
  cover?: IgdbCover;
  screenshots?: IgdbScreenshot[];
  multiplayer_modes?: IgdbMultiplayerMode[];
}

export interface IgdbGenre {
  id: number;
  name: string;
}

export interface IgdbTheme {
  id: number;
  name: string;
}

export interface IgdbGameMode {
  id: number;
  name: string;
}

export interface IgdbPlatform {
  id: number;
  name: string;
  abbreviation?: string;
}

export interface IgdbPlayerPerspective {
  id: number;
  name: string;
}

export interface IgdbKeyword {
  id: number;
  name: string;
}

export interface IgdbInvolvedCompany {
  id: number;
  company: { id: number; name: string };
  developer: boolean;
  publisher: boolean;
}

export interface IgdbCover {
  id: number;
  image_id: string;
  url?: string;
}

export interface IgdbScreenshot {
  id: number;
  image_id: string;
}

export interface IgdbMultiplayerMode {
  id: number;
  onlinemax?: number;
  offlinemax?: number;
  offlinecoopmax?: number;
  lancoop?: boolean;
}
