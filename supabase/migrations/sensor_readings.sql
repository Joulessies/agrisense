-- AgriSense: device readings written by ESP32 (PostgREST) and read by the web app.
-- Run this in Supabase SQL Editor or via `supabase db push`.

create table if not exists public.sensor_readings (
  id bigint generated always as identity primary key,
  recorded_at timestamptz not null default now(),
  device_id text,
  soil_moisture integer,
  temperature real,
  humidity real,
  lux real
);

create index if not exists sensor_readings_recorded_at_idx
  on public.sensor_readings (recorded_at desc);

comment on table public.sensor_readings is 'Time-series sensor samples from AgriSense ESP32 nodes.';

alter table public.sensor_readings enable row level security;

-- Dev/demo: open read/write for requests using the anon key.
-- Tighten these before production (e.g. Edge Function + device tokens, or stricter checks).
create policy "sensor_readings_anon_select"
  on public.sensor_readings for select
  to anon
  using (true);

create policy "sensor_readings_anon_insert"
  on public.sensor_readings for insert
  to anon
  with check (true);
