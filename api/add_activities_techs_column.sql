-- Add technician_ids array to daily_activities to track techs per activity
ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS technician_ids UUID[];

-- Update RLS for better clarity if needed
-- (The existing policies already reference report_id which works well)
