-- Make technician_id nullable in tasks table to allow unassigned OS
ALTER TABLE tasks ALTER COLUMN technician_id DROP NOT NULL;
