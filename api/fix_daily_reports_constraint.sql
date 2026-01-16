-- Fix Daily Reports constraint to allow manual technician selection (team_id = NULL)

-- 1. Add the technician_ids column if not exists
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS technician_ids UUID[];

-- 2. Drop the old unique constraint that blocks NULL team_id
ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_date_team_id_company_id_key;

-- 3. Create partial unique indexes instead
-- When team_id is NOT NULL, unique by (date, team_id, company_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_team_date 
    ON daily_reports (date, team_id, company_id) 
    WHERE team_id IS NOT NULL;

-- When team_id IS NULL, unique by (date, user_id, company_id) to allow one report per user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_user_date 
    ON daily_reports (date, user_id, company_id) 
    WHERE team_id IS NULL;
