
-- 0. Clean start (ensures new primary key structure)
DROP TABLE IF EXISTS measurement_prices CASCADE;

-- 1. Create table with composite primary key
CREATE TABLE IF NOT EXISTS measurement_prices (
  id TEXT NOT NULL, -- e.g. '1.1'
  company_id TEXT NOT NULL, -- e.g. 'gf1', 'alvares'
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  unit TEXT NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id, company_id)
);

-- 2. Enable RLS
ALTER TABLE measurement_prices ENABLE ROW LEVEL SECURITY;

-- 3. Create policies (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'measurement_prices' AND policyname = 'Users can view their own company prices'
    ) THEN
        -- Remove old policy if it exists under a different name
        DROP POLICY IF EXISTS "Measurement prices are viewable by authenticated users" ON measurement_prices;
        
        CREATE POLICY "Users can view their own company prices" 
        ON measurement_prices FOR SELECT 
        USING (
          company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) 
          OR 
          EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND company_id = 'internal')
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'measurement_prices' AND policyname = 'Chiefs and leaders can manage measurement prices'
    ) THEN
        -- Cleanup old restrictive policies
        DROP POLICY IF EXISTS "Internal chiefs and leaders can manage measurement prices" ON measurement_prices;
        
        CREATE POLICY "Chiefs and leaders can manage measurement prices" 
        ON measurement_prices FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.company_id = 'internal' OR profiles.company_id = measurement_prices.company_id)
            AND (profiles.role::text LIKE '%CHEFE%' OR profiles.role::text LIKE '%LIDER%')
          )
        );
    END IF;
END
$$;

-- 4. Seed initial data
-- 4. Clear any existing data (User requested to remove all seeded values)
TRUNCATE TABLE measurement_prices;
