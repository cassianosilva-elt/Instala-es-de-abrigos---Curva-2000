-- OPEC MANAGEMENT TABLE
CREATE TABLE opec_management (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opec_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assignment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE RLS
ALTER TABLE opec_management ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "OPEC items are viewable by company members" ON opec_management FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = opec_management.company_id OR profiles.company_id = 'internal')
  )
);

CREATE POLICY "Internal chiefs and leaders can manage OPEC items" ON opec_management FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      (profiles.company_id = 'internal' AND profiles.role IN ('CHEFE', 'LIDER')) OR
      (profiles.company_id = opec_management.company_id AND profiles.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);

-- REALTIME CONFIG
-- ALTER PUBLICATION supabase_realtime ADD TABLE opec_management;
