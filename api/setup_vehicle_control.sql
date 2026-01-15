-- 1. VEHICLES TABLE (FLEET)
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

-- Enable RLS for vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Policies for vehicles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'Vehicles are viewable by company members') THEN
        CREATE POLICY "Vehicles are viewable by company members" ON vehicles FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND (profiles.company_id = vehicles.company_id OR profiles.company_id = 'internal')
          )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'Internal members can manage fleet') THEN
        CREATE POLICY "Internal members can manage fleet" ON vehicles FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.company_id = 'internal'
          )
        );
    END IF;
END $$;

-- 2. MODIFY VEHICLE_CONTROL TABLE
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


-- REALTIME
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
    END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Could not add table to publication.';
END $$;
