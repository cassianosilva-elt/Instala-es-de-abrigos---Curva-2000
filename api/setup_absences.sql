-- Create employee_absences table
CREATE TABLE IF NOT EXISTS employee_absences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id TEXT NOT NULL, -- Needs to support both UUIDs (profiles) and UUIDs (invites) but we'll store as text for flexibility since they come from different tables
  employee_name TEXT NOT NULL,
  date DATE NOT NULL,
  reason TEXT NOT NULL, -- 'Falta Injustificada', 'Falta Justificada', 'Day Off', 'Atestado', 'Banco de Horas', 'Outros'
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  company_id TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;

-- Policies
-- Absences viewable by company members (same logic as invites/tasks)
CREATE POLICY "Absences viewable by company members" ON employee_absences FOR SELECT
USING (
  (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())) OR
  ((SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()) = 'internal')
);

-- Absences manageable by Chiefs/Leaders
CREATE POLICY "Absences manageable by chiefs and leaders" ON employee_absences FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND (
      (p.company_id = 'internal' AND p.role IN ('CHEFE', 'LIDER')) OR
      (p.company_id = employee_absences.company_id AND p.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);
