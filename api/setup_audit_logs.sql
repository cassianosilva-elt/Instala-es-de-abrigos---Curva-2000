-- 1. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create generic audit trigger function
CREATE OR REPLACE FUNCTION process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    current_uid UUID;
BEGIN
    -- Try to get current user ID from Supabase auth
    current_uid := auth.uid();

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id)
        VALUES (TG_TABLE_NAME, (new.id)::text, TG_OP, to_jsonb(new), current_uid);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id)
        VALUES (TG_TABLE_NAME, (new.id)::text, TG_OP, to_jsonb(old), to_jsonb(new), current_uid);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, user_id)
        VALUES (TG_TABLE_NAME, (old.id)::text, TG_OP, to_jsonb(old), current_uid);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apply triggers to critical tables
DROP TRIGGER IF EXISTS audit_tasks_trigger ON tasks;
CREATE TRIGGER audit_tasks_trigger
AFTER INSERT OR UPDATE OR DELETE ON tasks
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

DROP TRIGGER IF EXISTS audit_measurement_prices_trigger ON measurement_prices;
CREATE TRIGGER audit_measurement_prices_trigger
AFTER INSERT OR UPDATE OR DELETE ON measurement_prices
FOR EACH ROW EXECUTE FUNCTION process_audit_log();

-- 4. Enable RLS on audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for audit_logs
-- Only internal chiefs can see all logs
-- Partners can see logs for records belonging to their company (simplified for now: only internal can see)
CREATE POLICY "Internal chiefs can view all audit logs"
ON audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.company_id = 'internal'
        AND profiles.role = 'CHEFE'
    )
);

-- Log record_id text conversion note: 
-- For measurement_prices, the ID is TEXT. For tasks, it's TEXT.
-- (new.id)::text handles both.
