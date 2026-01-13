-- Create tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  asset_json JSONB NOT NULL, -- Store hydrated asset data
  service_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  technician_id TEXT NOT NULL,
  leader_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  description TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  blocking_reason TEXT,
  not_performed_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tasks are viewable by assigned technician."
  ON tasks FOR SELECT
  USING ( auth.uid()::text = technician_id );

CREATE POLICY "Tasks are viewable by leaders of the same company."
  ON tasks FOR SELECT
  USING ( 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id = tasks.company_id
      AND profiles.role IN ('LIDER', 'CHEFE', 'PARCEIRO_LIDER', 'PARCEIRO_CHEFE')
    )
  );

CREATE POLICY "Internal chiefs can see all tasks."
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.company_id = 'internal'
      AND profiles.role = 'CHEFE'
    )
  );

-- Enable Realtime for tasks table
-- Note: This must be done via the Supabase Dashboard or by adding the table to the 'supabase_realtime' publication
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
