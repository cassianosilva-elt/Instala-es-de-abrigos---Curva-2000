-- SCRIPT TO FIX USER DELETION ISSUES (ROBUST VERSION)
-- Adds missing ON DELETE CASCADE to foreign keys referencing auth.users and profiles
-- Only attempts changes if the tables exist to avoid "relation does not exist" errors.

DO $$ 
BEGIN
    -- 1. Table: teams (leader_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;
        ALTER TABLE teams ADD CONSTRAINT teams_leader_id_fkey 
            FOREIGN KEY (leader_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated teams table';
    ELSE
        RAISE NOTICE 'Table teams does not exist, skipping';
    END IF;

    -- 2. Table: chat_messages (sender_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
        ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
        ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey 
            FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated chat_messages table';
    ELSE
        RAISE NOTICE 'Table chat_messages does not exist, skipping';
    END IF;

    -- 3. Table: daily_reports (user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_reports') THEN
        ALTER TABLE daily_reports DROP CONSTRAINT IF EXISTS daily_reports_user_id_fkey;
        ALTER TABLE daily_reports ADD CONSTRAINT daily_reports_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated daily_reports table';
    ELSE
        RAISE NOTICE 'Table daily_reports does not exist, skipping';
    END IF;

    -- 4. Table: vehicle_control (user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicle_control') THEN
        ALTER TABLE vehicle_control DROP CONSTRAINT IF EXISTS vehicle_control_user_id_fkey;
        ALTER TABLE vehicle_control ADD CONSTRAINT vehicle_control_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated vehicle_control table';
    ELSE
        RAISE NOTICE 'Table vehicle_control does not exist, skipping';
    END IF;

    -- 5. Table: audit_logs (user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated audit_logs table';
    ELSE
        RAISE NOTICE 'Table audit_logs does not exist, skipping';
    END IF;

    -- 6. Table: employee_absences (created_by)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_absences') THEN
        ALTER TABLE employee_absences DROP CONSTRAINT IF EXISTS employee_absences_created_by_fkey;
        ALTER TABLE employee_absences ADD CONSTRAINT employee_absences_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
        RAISE NOTICE 'Updated employee_absences table';
    ELSE
        RAISE NOTICE 'Table employee_absences does not exist, skipping';
    END IF;

END $$;
