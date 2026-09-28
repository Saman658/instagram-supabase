-- Fix authentication and RLS issues
-- 1. Add auth_user_id column to users table to link Supabase Auth users to public users
-- 2. Fix RLS policies on all tables

-- Add auth_user_id column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique index on auth_user_id (one auth user per public user)
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_user_id_idx ON public.users(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Update existing users with their corresponding auth_user_id
-- Note: This will be populated after auth users are created
-- For now, we'll leave them NULL and update via application code or separate script

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Authenticated users can create follows" ON public.followers;
DROP POLICY IF EXISTS "Authenticated users can delete their own follows" ON public.followers;
DROP POLICY IF EXISTS "Allow insert posts" ON public.posts;
DROP POLICY IF EXISTS "Users can insert their own posts" ON public.posts;
DROP POLICY IF EXISTS "Allow users to insert comments" ON public.comments;
DROP POLICY IF EXISTS "Allow users to insert likes" ON public.likes;

-- Followers policies: Use auth_user_id mapping
-- Users can follow others (insert)
CREATE POLICY "Users can follow others" ON public.followers
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = follower_id
            AND u.auth_user_id = auth.uid()
        )
        AND follower_id != following_id  -- Prevent self-follow
    );

-- Users can unfollow (delete their own follows)
CREATE POLICY "Users can unfollow" ON public.followers
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = follower_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can view followers/following
CREATE POLICY "Users can view followers" ON public.followers
    FOR SELECT
    TO authenticated
    USING (true);

-- Posts policies: Users can insert their own posts (via auth_user_id mapping)
CREATE POLICY "Users can insert their own posts" ON public.posts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" ON public.posts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts" ON public.posts
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Public read access to posts (keep existing)
-- Already exists: "Allow public read access to posts"

-- Comments policies: Users can insert comments on any post (authenticated only)
CREATE POLICY "Authenticated users can insert comments" ON public.comments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON public.comments
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON public.comments
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Public read access to comments (keep existing)
-- Already exists: "Allow users to read comments"

-- Likes policies: Users can insert likes (authenticated only)
CREATE POLICY "Authenticated users can insert likes" ON public.likes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes" ON public.likes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = user_id
            AND u.auth_user_id = auth.uid()
        )
    );

-- Public read access to likes (keep existing)
-- Already exists: "Allow users to read likes"

-- Users policies: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- Users can view all profiles (public read)
-- Already exists: "Allow public read users"