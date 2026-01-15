-- FIX FOR OPEC ASSIGNMENT ERROR
-- Removes the foreign key constraint and changes employee_id to TEXT to support pending employees

ALTER TABLE opec_management 
  DROP CONSTRAINT IF EXISTS opec_management_employee_id_fkey;

ALTER TABLE opec_management 
  ALTER COLUMN employee_id TYPE TEXT;
