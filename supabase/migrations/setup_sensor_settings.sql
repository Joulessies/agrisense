-- Create sensor_settings table
CREATE TABLE public.sensor_settings (
  id text primary key,
  optimal_min numeric not null,
  optimal_max numeric not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.sensor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sensor settings are viewable by everyone." 
  ON public.sensor_settings FOR SELECT USING (true);

-- Assuming updating is handled by application logic that checks role, but let's allow authenticated users or anyone for demo
CREATE POLICY "Sensor settings can be updated by everyone." 
  ON public.sensor_settings FOR UPDATE USING (true);

-- Insert initial thresholds
INSERT INTO public.sensor_settings (id, optimal_min, optimal_max) VALUES
  ('soilMoisture', 20, 40),
  ('temperature', 25, 32),
  ('humidity', 40, 70),
  ('light', 10000, 20000)
ON CONFLICT (id) DO NOTHING;

-- Add to Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_settings;
