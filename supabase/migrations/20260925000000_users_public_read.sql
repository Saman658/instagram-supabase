-- Add public/anonymous SELECT policy so the users profiles list is readable without a Supabase Auth account
DROP POLICY IF EXISTS "users_select_public" ON public.users;

CREATE POLICY "users_select_public"
ON public.users
FOR SELECT
TO anon
USING (true);
