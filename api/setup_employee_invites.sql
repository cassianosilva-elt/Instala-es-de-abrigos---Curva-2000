-- Create employee_invites table for bulk import
CREATE TABLE IF NOT EXISTS employee_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'TECNICO', -- 'TECNICO', 'LIDER', 'CHEFE', etc.
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  
  -- New fields
  shift TEXT, -- 'Turno' (DIA, NOITE)
  code TEXT,  -- 'Cadastro'
  leader_name TEXT, -- 'Liderança'
  original_status TEXT, -- Status from Excel (ativo, afastado, etc)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;

-- Policies
-- Invites viewable by company members
DROP POLICY IF EXISTS "Invites viewable by company members" ON employee_invites;
CREATE POLICY "Invites viewable by company members" ON employee_invites FOR SELECT
USING (
  (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())) OR
  ((SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()) = 'internal')
);

-- Invites manageable by Chiefs/Leaders
DROP POLICY IF EXISTS "Invites manageable by chiefs and leaders" ON employee_invites;
CREATE POLICY "Invites manageable by chiefs and leaders" ON employee_invites FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND (
      (p.company_id = 'internal' AND p.role IN ('CHEFE', 'LIDER')) OR
      (p.company_id = employee_invites.company_id AND p.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);

-- Migration helper (if running on existing table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_invites' AND column_name = 'shift') THEN
        ALTER TABLE employee_invites ADD COLUMN shift TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_invites' AND column_name = 'code') THEN
        ALTER TABLE employee_invites ADD COLUMN code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_invites' AND column_name = 'leader_name') THEN
        ALTER TABLE employee_invites ADD COLUMN leader_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employee_invites' AND column_name = 'original_status') THEN
        ALTER TABLE employee_invites ADD COLUMN original_status TEXT;
    END IF;
END $$;
