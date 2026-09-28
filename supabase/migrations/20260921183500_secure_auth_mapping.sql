ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx
ON public.users(auth_user_id)
WHERE auth_user_id IS NOT NULL;

DROP POLICY IF EXISTS "Authenticated users can view followers" ON public.followers;
DROP POLICY IF EXISTS "Users can view followers" ON public.followers;
DROP POLICY IF EXISTS "Users can follow others" ON public.followers;
DROP POLICY IF EXISTS "Users can unfollow" ON public.followers;
DROP POLICY IF EXISTS "followers_select_authenticated" ON public.followers;
DROP POLICY IF EXISTS "followers_insert_authenticated" ON public.followers;
DROP POLICY IF EXISTS "followers_delete_authenticated" ON public.followers;
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "posts_select_authenticated" ON public.posts;

CREATE POLICY "followers_select_authenticated"
ON public.followers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "followers_insert_authenticated"
ON public.followers
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.users AS actor
        WHERE actor.id = followers.follower_id
          AND actor.auth_user_id = auth.uid()
    )
    AND followers.follower_id <> followers.following_id
);

CREATE POLICY "followers_delete_authenticated"
ON public.followers
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.users AS actor
        WHERE actor.id = followers.follower_id
          AND actor.auth_user_id = auth.uid()
    )
);

CREATE POLICY "users_select_authenticated"
ON public.users
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "posts_select_authenticated"
ON public.posts
FOR SELECT
TO authenticated
USING (true);
