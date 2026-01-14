-- FIX FOR INFINITE RECURSION IN PROFILES RLS POLICY
-- The issue: Policies on 'profiles' table were querying 'profiles' table itself,
-- causing an infinite loop when checking permissions.

-- STEP 1: Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone in company" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- STEP 2: Create new policies that DO NOT reference the profiles table itself

-- SELECT: Allow authenticated users to view all profiles (simple policy, no self-reference)
CREATE POLICY "Profiles are viewable by authenticated users" ON profiles 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- INSERT: Users can only insert a profile for themselves
CREATE POLICY "Users can insert own profile" ON profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- UPDATE: Users can only update their own profile
CREATE POLICY "Users can update own profile" ON profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- STEP 3: Ensure the trigger function is properly set up with SECURITY DEFINER
-- This allows it to bypass RLS when creating the profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, company_id, company_name, avatar)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'Usuário'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'TECNICO'),
    COALESCE(new.raw_user_meta_data->>'company_id', 'internal'),
    COALESCE(new.raw_user_meta_data->>'company_name', 'Eletromidia'),
    new.raw_user_meta_data->>'avatar'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(new.raw_user_meta_data->>'name', profiles.name),
    role = COALESCE(new.raw_user_meta_data->>'role', profiles.role),
    company_id = COALESCE(new.raw_user_meta_data->>'company_id', profiles.company_id),
    company_name = COALESCE(new.raw_user_meta_data->>'company_name', profiles.company_name),
    avatar = COALESCE(new.raw_user_meta_data->>'avatar', profiles.avatar);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- STEP 4: Fix other tables that also had similar issues (referencing profiles in their policies)
-- For these, we'll use a helper function to get the company_id safely

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS TEXT AS $$
DECLARE
  my_company TEXT;
BEGIN
  SELECT company_id INTO my_company FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(my_company, 'internal');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Now update Tasks policies to use this function
DROP POLICY IF EXISTS "Tasks visibility rule" ON tasks;
CREATE POLICY "Tasks visibility rule" ON tasks FOR SELECT
USING (
  (technician_id = auth.uid()::text) OR
  (company_id = public.get_my_company_id()) OR
  (public.get_my_company_id() = 'internal')
);

-- Keep management policy simpler
DROP POLICY IF EXISTS "Management can manage tasks" ON tasks;
CREATE POLICY "Management can manage tasks" ON tasks FOR ALL
USING (
  (public.get_my_company_id() = 'internal') OR 
  (company_id = public.get_my_company_id())
);

-- Fix Teams policies
DROP POLICY IF EXISTS "Teams visibility rule" ON teams;
DROP POLICY IF EXISTS "Teams are viewable by company members" ON teams;
DROP POLICY IF EXISTS "Internal chiefs and leaders can manage teams" ON teams;

CREATE POLICY "Teams visibility rule" ON teams FOR SELECT
USING (
  (company_id = public.get_my_company_id()) OR
  (public.get_my_company_id() = 'internal')
);

CREATE POLICY "Teams management rule" ON teams FOR ALL
USING (
  (public.get_my_company_id() = 'internal') OR 
  (company_id = public.get_my_company_id())
);

-- Done! The infinite recursion issue should now be fixed.
