-- Allow authenticated users to insert their own preparer_users row
CREATE POLICY "Users can insert own preparer link"
ON public.preparer_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);