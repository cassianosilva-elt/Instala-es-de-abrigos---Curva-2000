-- 1. Add evidence_url to employee_absences
ALTER TABLE employee_absences ADD COLUMN IF NOT EXISTS evidence_url TEXT;

-- 2. Create the absences bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'absences', 'absences', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'absences'
);

-- 3. Storage Policies for absences bucket
-- Allow authenticated users to upload to absences folder
CREATE POLICY "Anyone can upload absence evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'absences');

-- Allow anyone to view absence evidence (public bucket, but let's be explicit)
CREATE POLICY "Anyone can view absence evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'absences');

-- Allow owners/admins to delete
CREATE POLICY "Admins can delete absence evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'absences');
