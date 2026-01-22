-- Add car_plate and opec_id columns to daily_activities table
-- This allows each activity to have its own vehicle and OPEC instead of inheriting from the report

ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS car_plate TEXT;
ALTER TABLE daily_activities ADD COLUMN IF NOT EXISTS opec_id TEXT;

-- Optional: backfill existing activities with report-level values
UPDATE daily_activities da
SET 
    car_plate = dr.car_plate,
    opec_id = dr.opec_id
FROM daily_reports dr
WHERE da.report_id = dr.id
AND da.car_plate IS NULL;
