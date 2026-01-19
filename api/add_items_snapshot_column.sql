-- Migration: Add items_snapshot column to asset_measurements
-- This stores the exact price values at the time of measurement (snapshot)
-- to avoid discrepancies if the contract changes in the future.

-- 1. Add items_snapshot column
ALTER TABLE asset_measurements 
ADD COLUMN IF NOT EXISTS items_snapshot JSONB DEFAULT '[]'::jsonb;

-- Comment explaining the column purpose
COMMENT ON COLUMN asset_measurements.items_snapshot IS 
'Stores snapshot of price items at measurement time. Format: [{stage, description, price, unit}]';

-- 2. Create an index for efficient querying by company
CREATE INDEX IF NOT EXISTS idx_asset_measurements_company_date 
ON asset_measurements(company_id, created_at DESC);
