-- 1. Ensure Table Integrity

CREATE TABLE IF NOT EXISTS public.sensor_settings (
  id text primary key,
  optimal_min numeric not null,
  optimal_max numeric not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id bigint generated always as identity primary key,
    created_at timestamptz not null default now(),
    time text not null,
    text text not null,
    tone text not null default 'info'
);

CREATE TABLE IF NOT EXISTS public.nodes (
    id text primary key,
    zone text,
    type text,
    battery integer,
    signal integer,
    online boolean default true,
    last_seen timestamptz default now()
);

-- Seed defaults
INSERT INTO public.sensor_settings (id, optimal_min, optimal_max) VALUES
  ('soilMoisture', 20, 40),
  ('temperature', 25, 32),
  ('humidity', 40, 70),
  ('light', 10000, 20000)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.sensor_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sensor settings are viewable by everyone." ON public.sensor_settings;
DROP POLICY IF EXISTS "Sensor settings can be updated by everyone." ON public.sensor_settings;
CREATE POLICY "sensor_settings_public_select" ON public.sensor_settings FOR SELECT TO public USING (true);
CREATE POLICY "sensor_settings_public_update" ON public.sensor_settings FOR UPDATE TO public USING (true);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_logs_public_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_public_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_public_select" ON public.activity_logs FOR SELECT TO public USING (true);
CREATE POLICY "activity_logs_public_insert" ON public.activity_logs FOR INSERT TO public WITH CHECK (true);

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nodes_public_select" ON public.nodes;
DROP POLICY IF EXISTS "nodes_public_update" ON public.nodes;
DROP POLICY IF EXISTS "nodes_public_insert" ON public.nodes;
CREATE POLICY "nodes_public_select" ON public.nodes FOR SELECT TO public USING (true);
CREATE POLICY "nodes_public_update" ON public.nodes FOR UPDATE TO public USING (true);
CREATE POLICY "nodes_public_insert" ON public.nodes FOR INSERT TO public WITH CHECK (true);

-- Ensure Realtime is enabled for these tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;

-- 2. Processing Trigger and Function

CREATE OR REPLACE FUNCTION public.check_sensor_thresholds()
RETURNS TRIGGER AS $$
DECLARE
    settings_rec RECORD;
    val NUMERIC;
    time_str TEXT;
BEGIN
    -- Format time for UI (e.g., 10:30 AM)
    time_str := to_char(NEW.recorded_at AT TIME ZONE 'UTC', 'HH12:MI AM');

    -- Auto-discover and update nodes
    IF NEW.device_id IS NOT NULL THEN
        UPDATE public.nodes 
        SET last_seen = NEW.recorded_at, online = true 
        WHERE id = NEW.device_id;
        
        IF NOT FOUND THEN
            INSERT INTO public.nodes (id, zone, type, battery, signal, online, last_seen)
            VALUES (NEW.device_id, 'Unassigned', 'Sensor Node', 100, -50, true, NEW.recorded_at);
        END IF;
    END IF;

    -- Generate alerts
    FOR settings_rec IN SELECT * FROM public.sensor_settings LOOP
        val := NULL;
        IF settings_rec.id = 'temperature' THEN val := NEW.temperature;
        ELSIF settings_rec.id = 'humidity' THEN val := NEW.humidity;
        ELSIF settings_rec.id = 'soilMoisture' THEN val := NEW.soil_moisture;
        ELSIF settings_rec.id = 'light' THEN val := NEW.lux;
        END IF;

        IF val IS NOT NULL THEN
            IF val > settings_rec.optimal_max THEN
                INSERT INTO public.activity_logs (time, text, tone)
                VALUES (time_str, 'High ' || settings_rec.id || ' detected: ' || val, 'warning');
            ELSIF val < settings_rec.optimal_min THEN
                INSERT INTO public.activity_logs (time, text, tone)
                VALUES (time_str, 'Low ' || settings_rec.id || ' detected: ' || val, 'warning');
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sensor_reading_inserted ON public.sensor_readings;
CREATE TRIGGER on_sensor_reading_inserted
    AFTER INSERT ON public.sensor_readings
    FOR EACH ROW
    EXECUTE PROCEDURE public.check_sensor_thresholds();

-- 3. Analytics View
CREATE OR REPLACE VIEW public.sensor_analytics_daily AS
SELECT
    date_trunc('day', recorded_at) AS day,
    AVG(temperature) AS avg_temperature,
    AVG(humidity) AS avg_humidity,
    AVG(soil_moisture) AS avg_soil_moisture,
    AVG(lux) AS avg_lux,
    MIN(temperature) AS min_temperature,
    MAX(temperature) AS max_temperature
FROM public.sensor_readings
GROUP BY date_trunc('day', recorded_at)
ORDER BY day DESC;
