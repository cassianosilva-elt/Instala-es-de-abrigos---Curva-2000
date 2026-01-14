-- REFINED RLS POLICIES FOR ELETROMIDIA FIELD MANAGER

-- 1. PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone in company" ON profiles;
CREATE POLICY "Profiles are viewable by everyone in company" ON profiles FOR SELECT
USING (
  (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())) OR
  ((SELECT company_id FROM profiles WHERE id = auth.uid()) = 'internal')
);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE
USING (auth.uid() = id);

-- 2. TASKS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

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

-- 3. TEAMS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teams visibility rule" ON teams;
CREATE POLICY "Teams visibility rule" ON teams FOR SELECT
USING (
  (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid())) OR
  ((SELECT company_id FROM profiles WHERE id = auth.uid()) = 'internal')
);

-- 4. ASSETS (Read-only for all authenticated)
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Assets are viewable by everyone" ON assets;
CREATE POLICY "Assets are viewable by everyone" ON assets FOR SELECT
USING (auth.role() = 'authenticated');

-- 5. CHAT
-- (Conversations/Messages policies are already specific to participants in setup_full_schema.sql)
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
