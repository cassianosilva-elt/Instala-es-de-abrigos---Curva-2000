-- 1. Remove foreign key from teams.leader_id to allow pending leaders
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_leader_id_fkey;

-- 2. Update handle_new_user trigger to claim teams and tasks
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    invite_data RECORD;
BEGIN
    -- Look for a pending invite with this email
    SELECT * INTO invite_data FROM public.employee_invites WHERE email = new.email LIMIT 1;

    -- Insert into profiles
    INSERT INTO public.profiles (id, name, email, role, company_id, company_name, avatar, shift, code, leader_name, original_status)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', invite_data.name),
        new.email,
        COALESCE(new.raw_user_meta_data->>'role', invite_data.role, 'TECNICO'),
        COALESCE(new.raw_user_meta_data->>'company_id', invite_data.company_id, 'internal'),
        COALESCE(new.raw_user_meta_data->>'company_name', invite_data.company_name, 'Eletromidia'),
        COALESCE(new.raw_user_meta_data->>'avatar', 'https://ui-avatars.com/api/?name=' || COALESCE(new.raw_user_meta_data->>'name', invite_data.name, 'U')),
        invite_data.shift,
        invite_data.code,
        invite_data.leader_name,
        invite_data.original_status
    );

    -- Claim teams where this user (as an invite ID) was the leader
    IF invite_data.id IS NOT NULL THEN
        UPDATE public.teams SET leader_id = new.id::text WHERE leader_id = invite_data.id::text;
        -- Update technicians array: this is harder with TEXT[], but if we stored them as TEXT[] of UUIDs/InviteIDs:
        -- Just a simple attempt if technician_ids contains the invite_id as string
        UPDATE public.teams 
        SET technician_ids = array_replace(technician_ids, invite_data.id::text, new.id::text)
        WHERE invite_data.id::text = ANY(technician_ids);

        -- Claim tasks
        UPDATE public.tasks SET technician_id = new.id::text WHERE technician_id = invite_data.id::text;
        UPDATE public.tasks SET leader_id = new.id::text WHERE leader_id = invite_data.id::text;

        -- Delete the invite
        DELETE FROM public.employee_invites WHERE id = invite_data.id;
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
