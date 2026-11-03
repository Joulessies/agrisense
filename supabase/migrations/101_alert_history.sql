-- 101_alert_history.sql
-- Table to store hazard lifecycle: start, resolution, reading, and email dispatch status

CREATE TABLE IF NOT EXISTS public.alert_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now(),
    hazard_type text NOT NULL,
    sensor_id text NOT NULL,
    reading_value text NOT NULL,
    threshold_limit text NOT NULL,
    status text NOT NULL DEFAULT 'active', -- 'active' | 'resolved'
    triggered_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    duration_seconds integer,
    email_sent boolean DEFAULT false,
    recipient text
);

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "alert_history_public_select" ON public.alert_history;
DROP POLICY IF EXISTS "alert_history_public_insert" ON public.alert_history;
DROP POLICY IF EXISTS "alert_history_public_update" ON public.alert_history;

CREATE POLICY "alert_history_public_select" ON public.alert_history FOR SELECT TO public USING (true);
CREATE POLICY "alert_history_public_insert" ON public.alert_history FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "alert_history_public_update" ON public.alert_history FOR UPDATE TO public WITH CHECK (true);

