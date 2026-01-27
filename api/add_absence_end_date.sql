-- Add end_date column to both daily_absences and employee_absences to maintain consistency
ALTER TABLE daily_absences ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE employee_absences ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update existing records to have end_date = date
UPDATE daily_absences SET end_date = date WHERE end_date IS NULL;
UPDATE employee_absences SET end_date = date WHERE end_date IS NULL;
