-- Add INSERT policy for users table so authenticated users can create their profile
CREATE POLICY "users_insert_authenticated"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());