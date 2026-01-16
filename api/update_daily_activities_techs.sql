-- Add technician_ids array to daily_activities table to track who performed each activity
ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS technician_ids UUID[];

-- (Optional) If we want to clean up old activities without technician_ids later, we can.
-- For now, existing activities will have null technician_ids (implying the whole team did it, or unknown).
