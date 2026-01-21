-- Migration to support editing measurements
ALTER TABLE asset_measurements 
ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- Comment for clarity
COMMENT ON COLUMN asset_measurements.edit_count IS 'Number of times this measurement has been edited (max 4)';
COMMENT ON COLUMN asset_measurements.is_paid IS 'Indicates if the first measurement has already been paid';
