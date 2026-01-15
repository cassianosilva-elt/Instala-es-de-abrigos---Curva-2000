-- FIX FOR VEHICLE REGISTRATION ISSUE
-- This script creates the missing 'vehicles' table and ensures 'vehicle_control' has all required columns.

-- 1. CREATE VEHICLES TABLE (FLEET)
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  company_id TEXT NOT NULL,
  current_km INTEGER NOT NULL DEFAULT 0,
  last_maintenance_km INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Disponível', -- 'Disponível', 'Em Manutenção', 'Em Uso'
  maintenance_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. CREATE VEHICLE_CONTROL TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS vehicle_control (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  shift TEXT NOT NULL,
  occurrence_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  company_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ENSURE VEHICLE_CONTROL HAS ALL COLUMNS
DO $$ 
BEGIN
    -- Add vehicle_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='vehicle_id') THEN
        ALTER TABLE vehicle_control ADD COLUMN vehicle_id UUID REFERENCES vehicles(id);
    END IF;

    -- Add start_km
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='start_km') THEN
        ALTER TABLE vehicle_control ADD COLUMN start_km INTEGER;
    END IF;

    -- Add end_km
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='end_km') THEN
        ALTER TABLE vehicle_control ADD COLUMN end_km INTEGER;
    END IF;

    -- Add is_active
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='is_active') THEN
        ALTER TABLE vehicle_control ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- Add checkin_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='checkin_time') THEN
        ALTER TABLE vehicle_control ADD COLUMN checkin_time TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add additional_collaborators
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vehicle_control' AND column_name='additional_collaborators') THEN
        ALTER TABLE vehicle_control ADD COLUMN additional_collaborators TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 4. ENABLE RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_control ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES FOR VEHICLES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Vehicles are viewable by company members" ON vehicles;
    CREATE POLICY "Vehicles are viewable by company members" ON vehicles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.company_id = vehicles.company_id OR profiles.company_id = 'internal')
      )
    );

    DROP POLICY IF EXISTS "Internal members can manage fleet" ON vehicles;
    CREATE POLICY "Internal members can manage fleet" ON vehicles FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.company_id = 'internal'
      )
    );
END $$;

-- 6. POLICIES FOR VEHICLE_CONTROL
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Vehicle control viewable by company" ON vehicle_control;
    CREATE POLICY "Vehicle control viewable by company" ON vehicle_control FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (profiles.company_id = vehicle_control.company_id OR profiles.company_id = 'internal')
      )
    );

    DROP POLICY IF EXISTS "Everyone authenticated can insert logs" ON vehicle_control;
    CREATE POLICY "Everyone authenticated can insert logs" ON vehicle_control FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

    DROP POLICY IF EXISTS "Everyone authenticated can update logs" ON vehicle_control;
    CREATE POLICY "Everyone authenticated can update logs" ON vehicle_control FOR UPDATE
    USING (auth.uid() IS NOT NULL);
END $$;

-- 7. REALTIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicle_control') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_control;
    END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add tables to publication.';
END $$;
