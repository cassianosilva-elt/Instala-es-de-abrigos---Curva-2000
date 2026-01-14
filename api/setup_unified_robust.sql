-- UTAG: UNIFIED ROBUST SETUP FOR ELETROMIDIA FIELD MANAGER
-- V3: DEFINITIVE FIX FOR TYPE MISMATCH (TEXT vs UUID)
-- USE ONLY IN ENGLISH (DISABLE BROWSER TRANSLATOR)

-- ⚠️ WARNING: The following lines will DROP tables and RECREATE them. 
-- Any data in these tables will be lost. This is necessary to fix type mismatches.

-- 0. CLEANUP (Drop tables in order of dependency)
DROP TABLE IF EXISTS task_evidences CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
-- We keep 'profiles' and 'assets' as they are likely correct, but let's be safe:
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP TABLE IF EXISTS assets CASCADE;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  avatar TEXT,
  team_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger Function
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

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TASKS TABLE (Using TEXT for IDs to match frontend strings)
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

-- 5. TASK EVIDENCES TABLE (Matching tasks.id type)
CREATE TABLE task_evidences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
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
-- Assets
DROP POLICY IF EXISTS "Assets are viewable by everyone" ON assets;
CREATE POLICY "Assets are viewable by everyone" ON assets FOR SELECT USING (auth.role() = 'authenticated');

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone in company" ON profiles;
CREATE POLICY "Profiles are viewable by everyone in company" ON profiles FOR SELECT
USING (
  (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())) OR
  ((SELECT company_id FROM profiles WHERE id = auth.uid()) = 'internal')
);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Tasks
DROP POLICY IF EXISTS "Tasks visibility rule" ON tasks;
CREATE POLICY "Tasks visibility rule" ON tasks FOR SELECT
USING (
  (technician_id = auth.uid()::text) OR
  (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())) OR
  ((SELECT company_id FROM profiles WHERE id = auth.uid()) = 'internal')
);
DROP POLICY IF EXISTS "Management can manage tasks" ON tasks;
CREATE POLICY "Management can manage tasks" ON tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      (profiles.company_id = 'internal' AND profiles.role IN ('CHEFE', 'LIDER')) OR
      (profiles.company_id = tasks.company_id AND profiles.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);

-- Chat
DROP POLICY IF EXISTS "Users can see their conversations" ON chat_conversations;
CREATE POLICY "Users can see their conversations" ON chat_conversations FOR SELECT USING (auth.uid() = ANY(participants));
DROP POLICY IF EXISTS "Users can see messages in their conversations" ON chat_messages;
CREATE POLICY "Users can see messages in their conversations" ON chat_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND auth.uid() = ANY(participants)));
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON chat_messages;
CREATE POLICY "Users can send messages to their conversations" ON chat_messages FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND auth.uid() = ANY(participants)));
