-- Create a SECURITY DEFINER function to create user profile
-- This can be called from the client via RPC after signup

CREATE OR REPLACE FUNCTION public.create_user_profile(p_username TEXT, p_auth_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.users (username, auth_user_id)
    VALUES (p_username, p_auth_user_id)
    ON CONFLICT (auth_user_id) DO NOTHING;
END;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.create_user_profile(TEXT, UUID) TO anon, authenticated;