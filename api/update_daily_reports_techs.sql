-- Add technician_ids array to daily_reports
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS technician_ids UUID[];

-- Drop old constraint if we want to allow null team_id uniqueness
-- ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_date_team_id_company_id_key;

-- Better: unique per user per day if manual, or unique per team per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_team_date ON daily_reports (date, team_id, company_id) WHERE team_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_reports_user_date ON daily_reports (date, user_id, company_id) WHERE team_id IS NULL;
