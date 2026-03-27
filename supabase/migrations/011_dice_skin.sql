-- Add dice skin preference to user_preferences
-- Stores the ID of the user's chosen dice skin for the randomizer
ALTER TABLE user_preferences
ADD COLUMN dice_skin text DEFAULT 'classic-purple';
