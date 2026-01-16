-- Add tag column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tag TEXT;
