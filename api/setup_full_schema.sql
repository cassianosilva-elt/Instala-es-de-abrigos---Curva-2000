-- 1. ASSETS TABLE
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'Abrigo de Ônibus', 'Totem', etc.
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TEAMS TABLE
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  leader_id UUID REFERENCES auth.users(id),
  technician_ids TEXT[] NOT NULL DEFAULT '{}', -- Array of user IDs (UUIDs stored as text for flexibility)
  company_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TASK EVIDENCES TABLE
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

-- 4. CHAT SYSTEM
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

-- ENABLE RLS
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Assets: Viewable by everyone authenticated
CREATE POLICY "Assets are viewable by authenticated users" ON assets FOR SELECT USING (auth.role() = 'authenticated');

-- Teams: Viewable by company members
CREATE POLICY "Teams are viewable by company members" ON teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.company_id = teams.company_id OR profiles.company_id = 'internal')
  )
);

CREATE POLICY "Internal chiefs and leaders can manage teams" ON teams FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (
      (profiles.company_id = 'internal' AND profiles.role IN ('CHEFE', 'LIDER')) OR
      (profiles.company_id = teams.company_id AND profiles.role IN ('PARCEIRO_CHEFE', 'PARCEIRO_LIDER'))
    )
  )
);

-- Evidence: Viewable if you can see the task
CREATE POLICY "Evidence viewable by task stakeholders" ON task_evidences FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_evidences.task_id
  )
);

CREATE POLICY "Technicians can insert evidence" ON task_evidences FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE tasks.id = task_evidences.task_id 
    AND tasks.technician_id = auth.uid()::text
  )
);

-- Chat: Users can only see their own conversations
CREATE POLICY "Users can see their conversations" ON chat_conversations FOR SELECT
USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can see messages in their conversations" ON chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations 
    WHERE chat_conversations.id = chat_messages.conversation_id 
    AND auth.uid() = ANY(participants)
  )
);

CREATE POLICY "Users can send messages to their conversations" ON chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_conversations 
    WHERE chat_conversations.id = chat_messages.conversation_id 
    AND auth.uid() = ANY(participants)
  )
);

-- REALTIME CONFIG
-- You need to run this manually in the Supabase SQL Editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE teams;
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
