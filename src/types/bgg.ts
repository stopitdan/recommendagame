/**
 * BGG XML API2 response types.
 *
 * These types represent the parsed XML structure from BoardGameGeek's API.
 * They are internal to the BGG adapter — the rest of the app uses the
 * unified Game type from ./game.ts.
 *
 * Reference: https://boardgamegeek.com/wiki/page/BGG_XML_API2
 */

// ---------------------------------------------------------------------------
// /xmlapi2/search
// ---------------------------------------------------------------------------

export interface BggSearchResponse {
  items: {
    '@_total': string;
    item: BggSearchItem | BggSearchItem[];
  };
}

export interface BggSearchItem {
  '@_type': string;
  '@_id': string;
  name: {
    '@_type': string;
    '@_value': string;
  };
  yearpublished?: {
    '@_value': string;
  };
}

// ---------------------------------------------------------------------------
// /xmlapi2/thing?stats=1
// ---------------------------------------------------------------------------

export interface BggThingResponse {
  items: {
    item: BggThingItem | BggThingItem[];
  };
}

export interface BggThingItem {
  '@_type': string;
  '@_id': string;
  thumbnail?: string;
  image?: string;
  name: BggName | BggName[];
  description: string;
  yearpublished?: { '@_value': string };
  minplayers?: { '@_value': string };
  maxplayers?: { '@_value': string };
  playingtime?: { '@_value': string };
  minplaytime?: { '@_value': string };
  maxplaytime?: { '@_value': string };
  minage?: { '@_value': string };
  poll?: BggPoll | BggPoll[];
  link?: BggLink | BggLink[];
  statistics?: {
    ratings: BggRatings;
  };
}

export interface BggName {
  '@_type': 'primary' | 'alternate';
  '@_sortindex': string;
  '@_value': string;
}

// ---------------------------------------------------------------------------
// Polls (suggested_numplayers, suggested_playerage, language_dependence)
// ---------------------------------------------------------------------------

export interface BggPoll {
  '@_name': string;
  '@_title': string;
  '@_totalvotes': string;
  results: BggPollResults | BggPollResults[];
}

export interface BggPollResults {
  '@_numplayers'?: string;
  result: BggPollResult | BggPollResult[];
}

export interface BggPollResult {
  '@_value': string;
  '@_numvotes': string;
}

// ---------------------------------------------------------------------------
// Links (categories, mechanics, families, designers, etc.)
// ---------------------------------------------------------------------------

export interface BggLink {
  '@_type': string;
  '@_id': string;
  '@_value': string;
  '@_inbound'?: string;
}

/** Known link types we care about for game metadata */
export type BggLinkType =
  | 'boardgamecategory'
  | 'boardgamemechanic'
  | 'boardgamefamily'
  | 'boardgamedesigner'
  | 'boardgameartist'
  | 'boardgamepublisher'
  | 'boardgameexpansion'
  | 'boardgameimplementation'
  | 'boardgameintegration';

// ---------------------------------------------------------------------------
// Statistics / Ratings
// ---------------------------------------------------------------------------

export interface BggRatings {
  usersrated: { '@_value': string };
  average: { '@_value': string };
  bayesaverage: { '@_value': string };
  stddev?: { '@_value': string };
  median?: { '@_value': string };
  owned?: { '@_value': string };
  trading?: { '@_value': string };
  wanting?: { '@_value': string };
  wishing?: { '@_value': string };
  numcomments?: { '@_value': string };
  numweights?: { '@_value': string };
  averageweight: { '@_value': string };
  ranks?: {
    rank: BggRank | BggRank[];
  };
}

export interface BggRank {
  '@_type': string;
  '@_id': string;
  '@_name': string;
  '@_friendlyname': string;
  '@_value': string;
  '@_bayesaverage': string;
}

// ---------------------------------------------------------------------------
// /xmlapi2/hot
// ---------------------------------------------------------------------------

export interface BggHotResponse {
  items: {
    item: BggHotItem | BggHotItem[];
  };
}

export interface BggHotItem {
  '@_id': string;
  '@_rank': string;
  thumbnail?: { '@_value': string };
  name: { '@_value': string };
  yearpublished?: { '@_value': string };
}
