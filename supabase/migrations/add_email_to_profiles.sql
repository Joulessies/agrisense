-- Add email column to profiles and keep it in sync with auth.users

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Back-fill existing rows from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

-- Update the trigger so new sign-ups also store their email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'farmer')
  )
  ON CONFLICT (id) DO UPDATE
    SET name  = EXCLUDED.name,
        email = EXCLUDED.email,
        role  = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
