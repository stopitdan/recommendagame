/**
 * Supabase database type definitions.
 *
 * These types mirror the PostgreSQL schema defined in
 * supabase/migrations/001_initial_schema.sql
 *
 * In production, generate these automatically with:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 *
 * For now, we maintain them manually to stay in sync with our migration.
 */

export interface Database {
  public: {
    Tables: {
      games: {
        Row: GameRow;
        Insert: GameInsert;
        Update: GameUpdate;
        Relationships: [];
      };
      game_embeddings: {
        Row: GameEmbeddingRow;
        Insert: GameEmbeddingInsert;
        Update: GameEmbeddingUpdate;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
        Relationships: [];
      };
      user_preferences: {
        Row: UserPreferencesRow;
        Insert: UserPreferencesInsert;
        Update: UserPreferencesUpdate;
        Relationships: [];
      };
      user_game_feedback: {
        Row: UserGameFeedbackRow;
        Insert: UserGameFeedbackInsert;
        Update: UserGameFeedbackUpdate;
        Relationships: [];
      };
      user_favorites: {
        Row: UserFavoriteRow;
        Insert: UserFavoriteInsert;
        Update: never;
        Relationships: [];
      };
      custom_dice_skins: {
        Row: CustomDiceSkinRow;
        Insert: CustomDiceSkinInsert;
        Update: CustomDiceSkinUpdate;
        Relationships: [];
      };
      custom_dice_votes: {
        Row: CustomDiceVoteRow;
        Insert: CustomDiceVoteInsert;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_games: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          similarity_threshold?: number;
        };
        Returns: {
          game_id: string;
          similarity: number;
        }[];
      };
      search_games_by_name: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: GameRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

export interface GameRow {
  id: string;
  source: 'bgg' | 'rawg' | 'igdb' | 'local';
  source_id: string;
  name: string;
  description: string;
  year_published: number | null;
  types: string[];
  min_players: number | null;
  max_players: number | null;
  recommended_players: number | null;
  min_play_time: number | null;
  max_play_time: number | null;
  avg_play_time: number | null;
  complexity: number | null;
  rating: number | null;
  rating_count: number | null;
  categories: string[];
  mechanics: string[];
  themes: string[];
  platforms: string[];
  thumbnail_url: string | null;
  image_url: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameInsert {
  id: string;
  source: 'bgg' | 'rawg' | 'igdb' | 'local';
  source_id: string;
  name: string;
  description?: string;
  year_published?: number | null;
  types?: string[];
  min_players?: number | null;
  max_players?: number | null;
  recommended_players?: number | null;
  min_play_time?: number | null;
  max_play_time?: number | null;
  avg_play_time?: number | null;
  complexity?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  categories?: string[];
  mechanics?: string[];
  themes?: string[];
  platforms?: string[];
  thumbnail_url?: string | null;
  image_url?: string | null;
  source_url?: string | null;
}

export type GameUpdate = Partial<Omit<GameInsert, 'id' | 'source' | 'source_id'>>;

// ---------------------------------------------------------------------------
// Game Embeddings
// ---------------------------------------------------------------------------

export interface GameEmbeddingRow {
  game_id: string;
  embedding: number[];
  model_version: string;
  created_at: string;
}

export interface GameEmbeddingInsert {
  game_id: string;
  embedding: number[];
  model_version?: string;
}

export type GameEmbeddingUpdate = Partial<Omit<GameEmbeddingInsert, 'game_id'>>;

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export interface UserProfileRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileInsert {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

export type UserProfileUpdate = Partial<Omit<UserProfileInsert, 'id'>>;

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export interface UserPreferencesRow {
  id: string;
  preferred_types: string[];
  preferred_min_players: number | null;
  preferred_max_players: number | null;
  preferred_min_time: number | null;
  preferred_max_time: number | null;
  preferred_complexity_min: number | null;
  preferred_complexity_max: number | null;
  liked_categories: string[];
  disliked_categories: string[];
  liked_mechanics: string[];
  disliked_mechanics: string[];
  preference_vector: number[] | null;
  dice_skin: string | null;
  updated_at: string;
}

export interface UserPreferencesInsert {
  id: string;
  preferred_types?: string[];
  preferred_min_players?: number | null;
  preferred_max_players?: number | null;
  preferred_min_time?: number | null;
  preferred_max_time?: number | null;
  preferred_complexity_min?: number | null;
  preferred_complexity_max?: number | null;
  liked_categories?: string[];
  disliked_categories?: string[];
  liked_mechanics?: string[];
  disliked_mechanics?: string[];
  preference_vector?: number[] | null;
  dice_skin?: string | null;
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferencesInsert, 'id'>>;

// ---------------------------------------------------------------------------
// User Game Feedback
// ---------------------------------------------------------------------------

export interface UserGameFeedbackRow {
  id: number;
  user_id: string;
  game_id: string;
  rating: -1 | 1;
  context: string | null;
  created_at: string;
}

export interface UserGameFeedbackInsert {
  user_id: string;
  game_id: string;
  rating: -1 | 1;
  context?: string | null;
}

export type UserGameFeedbackUpdate = Pick<UserGameFeedbackInsert, 'rating'>;

// ---------------------------------------------------------------------------
// User Favorites
// ---------------------------------------------------------------------------

export interface UserFavoriteRow {
  id: number;
  user_id: string;
  game_id: string;
  created_at: string;
}

export interface UserFavoriteInsert {
  user_id: string;
  game_id: string;
}

// ---------------------------------------------------------------------------
// Custom Dice Skins
// ---------------------------------------------------------------------------

export interface CustomDiceSkinRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  config: Record<string, unknown>;
  is_public: boolean;
  vote_count: number;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomDiceSkinInsert {
  user_id: string;
  name: string;
  emoji?: string;
  config: Record<string, unknown>;
  is_public?: boolean;
}

export type CustomDiceSkinUpdate = Partial<Omit<CustomDiceSkinInsert, 'user_id'>>;

// ---------------------------------------------------------------------------
// Custom Dice Votes
// ---------------------------------------------------------------------------

export interface CustomDiceVoteRow {
  id: number;
  user_id: string;
  skin_id: string;
}

export interface CustomDiceVoteInsert {
  user_id: string;
  skin_id: string;
}
