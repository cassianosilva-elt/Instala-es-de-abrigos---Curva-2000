-- Remove the restrictive index that prevents multiple custom reports per day
DROP INDEX IF EXISTS idx_daily_reports_user_date;

-- We don't add a replacement unique index for ad-hoc reports because 
-- identifying them purely by technician arrays can be flaky if the order changes.
-- The application logic will handle selecting the correct report if it exists.
