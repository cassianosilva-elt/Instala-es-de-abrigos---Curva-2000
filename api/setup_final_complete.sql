-- UTAG: FINAL COMPLETE SETUP FOR ELETROMIDIA FIELD MANAGER
-- THIS SCRIPT WIPES ALL TABLES AND RECREATES A CLEAN STRUCTURE
-- USE ONLY IN ENGLISH (DISABLE BROWSER TRANSLATOR)

-- 0. CLEANUP (Wipe everything related to the project)
DROP TABLE IF EXISTS task_evidences CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS assets CASCADE;

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL, -- 'TECNICO', 'LIDER', 'CHEFE', 'PARCEIRO_CHEFE', 'PARCEIRO_LIDER'
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  avatar TEXT,
  team_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, company_id, company_name, avatar)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'),
    COALESCE(new.raw_user_meta_data->>'company_id', 'internal'),
    COALESCE(new.raw_user_meta_data->>'company_name', 'Eletromidia'),
    new.raw_user_meta_data->>'avatar'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ASSETS TABLE
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TASKS TABLE
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  asset_json JSONB NOT NULL,
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

-- 4. TEAMS TABLE
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_id UUID REFERENCES auth.users(id),
  technician_ids TEXT[] NOT NULL DEFAULT '{}',
  company_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TASK EVIDENCES TABLE
CREATE TABLE task_evidences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  stage TEXT NOT NULL, -- 'BEFORE', 'DURING', 'AFTER'
  photo_url TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION
);

-- 6. CHAT SYSTEM
CREATE TABLE chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participants UUID[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. STORAGE SETUP
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 8. ENABLE RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 9. POLICIES

-- Profiles
CREATE POLICY "Profiles are viewable by everyone in company" ON profiles FOR SELECT
USING (
  (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())) OR
  ((SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()) = 'internal')
);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK ( auth.uid() = id );

-- Assets
CREATE POLICY "Assets are viewable by everyone" ON assets FOR SELECT USING (auth.role() = 'authenticated');

-- Tasks
CREATE POLICY "Tasks visibility rule" ON tasks FOR SELECT
USING (
  (technician_id = auth.uid()::text) OR
  (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())) OR
  ((SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()) = 'internal')
);
CREATE POLICY "Management can manage tasks" ON tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() 
    AND (
      (p.company_id = 'internal' AND p.role IN ('CHEFE', 'LIDER')) OR
      (p.company_id = tasks.company_id AND p.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);

-- Teams
CREATE POLICY "Teams visibility rule" ON teams FOR SELECT
USING (
  (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())) OR
  ((SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()) = 'internal')
);

-- Chat
CREATE POLICY "Users can see their conversations" ON chat_conversations FOR SELECT USING (auth.uid() = ANY(participants));
CREATE POLICY "Users can see messages in their conversations" ON chat_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = chat_messages.conversation_id AND auth.uid() = ANY(c.participants)));
CREATE POLICY "Users can send messages to their conversations" ON chat_messages FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = chat_messages.conversation_id AND auth.uid() = ANY(c.participants)));

-- Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "User Upload" ON storage.objects;
CREATE POLICY "User Upload" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 10. SEED DATA (Assets)
INSERT INTO assets (id, code, type, address, lat, lng, city) VALUES
('asset_sp_001', 'ABR-SP-001', 'Abrigo de Ônibus', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP', -23.5615, -46.6623, 'São Paulo'),
('asset_sp_002', 'ABR-SP-002', 'Abrigo de Ônibus', 'Av. Brigadeiro Faria Lima, 2000 - Itaim Bibi, São Paulo - SP', -23.5855, -46.6815, 'São Paulo'),
('asset_sp_003', 'TOT-SP-001', 'Totem', 'Rua Oscar Freire, 500 - Cerqueira César, São Paulo - SP', -23.5661, -46.6673, 'São Paulo'),
('asset_sp_004', 'PAN-SP-001', 'Painel Digital', 'Av. das Nações Unidas, 12551 - Brooklin Novo, São Paulo - SP', -23.6088, -46.6967, 'São Paulo'),
('asset_rj_001', 'ABR-RJ-001', 'Abrigo de Ônibus', 'Av. Atlântica, 1702 - Copacabana, Rio de Janeiro - RJ', -22.9644, -43.1731, 'Rio de Janeiro'),
('asset_rj_002', 'ABR-RJ-002', 'Abrigo de Ônibus', 'Av. Vieira Souto, 100 - Ipanema, Rio de Janeiro - RJ', -22.9864, -43.1932, 'Rio de Janeiro'),
('asset_rj_003', 'TOT-RJ-001', 'Totem', 'Av. Mem de Sá, 100 - Lapa, Rio de Janeiro - RJ', -22.9134, -43.1852, 'Rio de Janeiro'),
('asset_bh_001', 'ABR-BH-001', 'Abrigo de Ônibus', 'Av. Afonso Pena, 1500 - Centro, Belo Horizonte - MG', -19.9245, -43.9352, 'Belo Horizonte'),
('asset_bh_002', 'ABR-BH-002', 'Abrigo de Ônibus', 'Av. do Contorno, 6000 - Savassi, Belo Horizonte - MG', -19.9392, -43.9398, 'Belo Horizonte'),
('asset_ct_001', 'ABR-CT-001', 'Abrigo de Ônibus', 'Rua XV de Novembro, 500 - Centro, Curitiba - PR', -25.4284, -49.2733, 'Curitiba'),
('asset_ct_002', 'PAN-CT-001', 'Painel Estático', 'Av. Sete de Setembro, 3000 - Rebouças, Curitiba - PR', -25.4391, -49.2689, 'Curitiba'),
('asset_sv_001', 'ABR-SV-001', 'Abrigo de Ônibus', 'Av. Oceanográfica, 500 - Barra, Salvador - BA', -13.0042, -38.5311, 'Salvador');
