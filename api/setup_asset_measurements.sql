
-- Table to store finalized measurements
CREATE TABLE IF NOT EXISTS asset_measurements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id TEXT REFERENCES assets(id),
  technician_id UUID REFERENCES profiles(id),
  company_id TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- The specific type selected in Step 1
  stages TEXT[] NOT NULL DEFAULT '{}', -- The stages selected in Step 2
  total_value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE asset_measurements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view measurements from their company" 
ON asset_measurements FOR SELECT 
USING (
  company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) 
  OR 
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = 'internal')
);

CREATE POLICY "Technicians can insert their own measurements" 
ON asset_measurements FOR INSERT 
WITH CHECK (auth.uid() = technician_id);

CREATE POLICY "Management can manage all measurements" 
ON asset_measurements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role::text LIKE '%CHEFE%' OR profiles.role::text LIKE '%LIDER%')
  )
);
