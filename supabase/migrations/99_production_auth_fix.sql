-- ============================================================================
-- Production Auth Fix — Run this in Supabase SQL Editor
-- ============================================================================
-- This migration fixes all authentication and registration issues for deployment
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)

-- 1. Ensure profiles table has all required columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'farmer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Back-fill missing data from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

UPDATE public.profiles p
SET name = COALESCE(p.name, u.raw_user_meta_data->>'name', u.email)
FROM auth.users u
WHERE p.id = u.id AND p.name IS NULL;

-- 2. Fix the trigger to be production-safe with proper error handling
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'farmer'),
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    name  = COALESCE(EXCLUDED.name, public.profiles.name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    role  = COALESCE(EXCLUDED.role, public.profiles.role);
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the auth flow
    RAISE WARNING 'handle_new_user failed for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;

-- Drop and recreate trigger (ensures it's using latest function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. Create admin account (safe — deletes existing first)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    admin_user_id uuid := gen_random_uuid();
BEGIN
    -- Clean up any existing admin account
    DELETE FROM auth.users WHERE email = 'admin@agrisense.com';
    DELETE FROM auth.identities WHERE identity_data->>'email' = 'admin@agrisense.com';
    DELETE FROM public.profiles WHERE email = 'admin@agrisense.com';

    -- Create new admin in auth.users
    INSERT INTO auth.users (
        instance_id, id, aud, role, email,
        encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        admin_user_id,
        'authenticated',
        'authenticated',
        'admin@agrisense.com',
        crypt('admin@123', gen_salt('bf')),
        now(),  -- Email is pre-confirmed
        '{"provider":"email","providers":["email"]}',
        '{"name":"System Admin","role":"admin"}',
        now(),
        now(),
        ''  -- Empty confirmation token = already confirmed
    );

    -- Create identity (required for sign-in in newer Supabase)
    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data,
        provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        admin_user_id,
        admin_user_id::text,
        jsonb_build_object(
            'sub', admin_user_id::text,
            'email', 'admin@agrisense.com',
            'email_verified', true,
            'provider', 'email'
        ),
        'email',
        now(),
        now(),
        now()
    );

    -- Create profile explicitly (don't rely on trigger for this critical account)
    INSERT INTO public.profiles (id, name, email, role, status, created_at)
    VALUES (
        admin_user_id,
        'System Admin',
        'admin@agrisense.com',
        'admin',
        'active',
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET name = 'System Admin',
        email = 'admin@agrisense.com',
        role = 'admin',
        status = 'active';

    RAISE NOTICE 'Admin account created: admin@agrisense.com / admin@123';
END $$;

-- 4. Verify everything is correct
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
    user_count int;
    profile_count int;
    identity_count int;
BEGIN
    SELECT COUNT(*) INTO user_count FROM auth.users WHERE email = 'admin@agrisense.com';
    SELECT COUNT(*) INTO profile_count FROM public.profiles WHERE email = 'admin@agrisense.com';
    SELECT COUNT(*) INTO identity_count FROM auth.identities WHERE identity_data->>'email' = 'admin@agrisense.com';
    
    IF user_count = 0 THEN
        RAISE EXCEPTION 'ERROR: Admin user not found in auth.users';
    END IF;
    
    IF profile_count = 0 THEN
        RAISE EXCEPTION 'ERROR: Admin profile not found in public.profiles';
    END IF;
    
    IF identity_count = 0 THEN
        RAISE EXCEPTION 'ERROR: Admin identity not found in auth.identities';
    END IF;
    
    RAISE NOTICE '✓ Admin account verified - all components present';
    RAISE NOTICE '  - auth.users: % row(s)', user_count;
    RAISE NOTICE '  - public.profiles: % row(s)', profile_count;
    RAISE NOTICE '  - auth.identities: % row(s)', identity_count;
END $$;
