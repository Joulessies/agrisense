-- Create profiles table
CREATE TABLE public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  role text default 'farmer',
  status text default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create trigger for new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', COALESCE(new.raw_user_meta_data->>'role', 'farmer'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Create nodes table
CREATE TABLE public.nodes (
  id text primary key,
  zone text not null,
  type text not null,
  battery numeric default 100,
  signal numeric default 100,
  online boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Nodes are viewable by everyone." ON public.nodes FOR SELECT USING (true);
CREATE POLICY "Nodes can be inserted by everyone." ON public.nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Nodes can be updated by everyone." ON public.nodes FOR UPDATE USING (true);


-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id uuid default gen_random_uuid() primary key,
  time text not null,
  text text not null,
  tone text default 'info',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activity logs are viewable by everyone." ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Activity logs can be inserted by everyone." ON public.activity_logs FOR INSERT WITH CHECK (true);


-- Create plant_info table (single row)
CREATE TABLE public.plant_info (
  id integer primary key default 1,
  age numeric not null,
  harvest_age numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.plant_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plant info is viewable by everyone." ON public.plant_info FOR SELECT USING (true);
CREATE POLICY "Plant info can be updated by everyone." ON public.plant_info FOR UPDATE USING (true);

-- Insert initial row for plant_info
INSERT INTO public.plant_info (id, age, harvest_age) VALUES (1, 180, 240) ON CONFLICT (id) DO NOTHING;

-- Turn on realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plant_info;

-- Create an Admin Account (Fix for Supabase login)
-- Email: admin@agrisense.com
-- Password: admin@123
DO $$
DECLARE
    new_user_id uuid := gen_random_uuid();
BEGIN
    -- Remove the user if it already exists to avoid conflicts
    DELETE FROM auth.users WHERE email = 'admin@agrisense.com';

    -- Insert the user into auth.users
    INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        new_user_id,
        'authenticated',
        'authenticated',
        'admin@agrisense.com',
        crypt('admin@123', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"name":"System Admin","role":"admin"}',
        now(),
        now()
    );

    -- Insert the corresponding identity (Required for login in newer Supabase versions)
    INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        new_user_id,
        new_user_id::text,
        jsonb_build_object('sub', new_user_id::text, 'email', 'admin@agrisense.com', 'email_verified', true),
        'email',
        now(),
        now(),
        now()
    );
END $$;
