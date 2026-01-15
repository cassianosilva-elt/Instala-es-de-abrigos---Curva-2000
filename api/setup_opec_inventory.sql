-- OPEC DEVICES TABLE (INVENTORY)
CREATE TABLE opec_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE, -- 'ATIVO ELETROMIDIA'
  phone_number TEXT,               -- 'Nº DA LINHA'
  brand TEXT,                      -- 'MARCA'
  model TEXT,                      -- 'MODELO'
  serial_number TEXT,              -- 'Nº SÉRIE'
  capacity TEXT,                   -- 'CAPACIDADE'
  imei_1 TEXT,                     -- 'IMEI 1'
  imei_2 TEXT,                     -- 'IMEI 2'
  observations TEXT,               -- 'OBS'
  company_id TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ENABLE RLS
ALTER TABLE opec_devices ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "OPEC devices are viewable by company members" ON opec_devices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = opec_devices.company_id OR profiles.company_id = 'internal')
  )
);

CREATE POLICY "Internal chiefs and leaders can manage OPEC devices" ON opec_devices FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      (profiles.company_id = 'internal' AND profiles.role IN ('CHEFE', 'LIDER')) OR
      (profiles.company_id = opec_devices.company_id AND profiles.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);
