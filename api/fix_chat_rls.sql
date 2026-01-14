-- Fix Chat RLS Policies
-- Run this in your Supabase SQL Editor

-- 1. Add policy to allow users to CREATE conversations
-- Users can create conversations where they are a participant
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
CREATE POLICY "Users can create conversations" ON chat_conversations FOR INSERT
WITH CHECK (auth.uid() = ANY(participants));

-- 2. Ensure the realtime is enabled for chat_messages (for live updates)
-- Uncomment and run if you want real-time:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

