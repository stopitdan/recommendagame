# Game Corrections System

Users can flag incorrect game data (player count, play time, complexity, etc.) via a corrections submission flow. Corrections are stored as pending suggestions and require admin review before being applied.

## Current State

- **Migration `023_game_corrections.sql`** creates the `game_corrections` table with RLS
- Users can INSERT their own corrections and SELECT their own submissions
- All corrections default to `status = 'pending'`
- No admin tooling, no application logic, no UI yet

## TODO: Backend

### Admin Review Policies

Add RLS policies so admins can manage corrections:

```sql
-- Admin can view all corrections
CREATE POLICY "Admins can view all corrections"
  ON public.game_corrections FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Admin can update correction status (approve/deny)
CREATE POLICY "Admins can update corrections"
  ON public.game_corrections FOR UPDATE
  USING (public.is_admin(auth.uid()));
```

This requires an `is_admin()` helper function or an admin role check. Options:
- A `user_roles` table with an `admin` flag
- A simple allowlist of admin user IDs in a Supabase function
- Supabase custom claims (JWT-based)

### Rate Limiting / Spam Prevention

Prevent abuse of the corrections table:

- **Option A:** Add a unique constraint on `(game_id, user_id, field_name)` so a user can only have one pending correction per field per game
- **Option B:** Rate limit in the API route (e.g., max 10 corrections per user per hour)
- **Option C:** Both

### Apply Approved Corrections

When an admin approves a correction, the corresponding field on the `games` table needs to be updated. Options:

- **Database function:** A trigger on `game_corrections` that fires when `status` changes to `'approved'`, updating the relevant field on `games`
- **API route:** An admin-only endpoint that approves the correction and updates the game in one transaction

The trigger approach is simpler but harder to debug. The API route approach gives more control and logging.

## TODO: Frontend

### User-Facing: Submit Correction

- Add a "Report incorrect data" button/link on game detail pages
- Form with: field selector (dropdown of correctable fields), suggested value, optional notes
- POST to an API route that inserts into `game_corrections`
- Show confirmation and link to view submitted corrections

### User-Facing: My Corrections

- A section (in profile or settings) showing the user's submitted corrections and their status (pending/approved/denied)

### Admin-Facing: Review Queue

- Page at `/admin/corrections` (or similar) listing all pending corrections
- Show: game name, field, current value, suggested value, user notes, submitted date
- Actions: Approve (applies the change) or Deny (with optional reason)
- Filter by status, sort by date

## Correctable Fields

Define which fields users can submit corrections for. Likely candidates:

- `min_players` / `max_players`
- `min_play_time` / `max_play_time`
- `min_age`
- `complexity` (weight)
- `categories` / `mechanics`
- `description` (flag inaccurate descriptions)

Store this allowlist somewhere (config or validation) so the API rejects corrections for invalid field names.
