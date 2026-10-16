'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

interface SensorReading {
  id: string | number;
  recorded_at: string;
  device_id: string;
  soil_moisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lux: number | null;
}

export function useRealtimeSync() {
  const { updateSensor, setNodes, setProfiles, setPlant, setActivity, setThresholds } = useStore();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const lastLanDbInsertMs = useRef<number>(0);
  const lastAudioChimeMs = useRef<number>(0);
  const lastKnownReadingId = useRef<string | number | null>(null);

  const checkCriticalAlerts = (soil?: number | null, temp?: number | null) => {
    const { audioAlertsEnabled, playAlertChime, criticalAlertSettings } = useStore.getState();
    if (!audioAlertsEnabled) return;
    const now = Date.now();
    if (now - lastAudioChimeMs.current < 45000) return;

    const limits = criticalAlertSettings || {
      minSoilMoisture: 10,
      maxSoilMoisture: 65,
      maxTemp: 38,
      minTemp: 12,
    };

    const isCritical =
      (soil != null && (soil < limits.minSoilMoisture || soil > limits.maxSoilMoisture)) ||
      (temp != null && (temp > limits.maxTemp || temp < limits.minTemp));

    if (isCritical) {
      lastAudioChimeMs.current = now;
      playAlertChime("critical");
    }
  };

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return;
    }

    const fetchInitialData = async () => {
      try {
        const [
          { data: nodesData },
          { data: profilesData },
          { data: plantData },
          { data: activityData },
          { data: settingsData },
          { data: readingsData }
        ] = await Promise.all([
          supabase.from('nodes').select('*').order('id'),
          supabase.from('profiles').select('*').order('name'),
          supabase.from('plant_info').select('*').limit(1).single(),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(30),
          supabase.from('sensor_settings').select('*'),
          supabase.from('sensor_readings').select('*').order('recorded_at', { ascending: false }).limit(1)
        ]);

        if (nodesData) setNodes(nodesData);
        if (profilesData) setProfiles(profilesData);
        if (plantData) setPlant({ age: plantData.age, harvestAge: plantData.harvest_age });
        if (activityData) setActivity(activityData);
        if (settingsData) setThresholds(settingsData);
        if (readingsData && readingsData.length > 0) {
          const row = readingsData[0] as SensorReading;
          lastKnownReadingId.current = row.id;
          if (row.soil_moisture != null) updateSensor('soilMoisture', row.soil_moisture);
          if (row.temperature != null) updateSensor('temperature', row.temperature);
          if (row.humidity != null) updateSensor('humidity', row.humidity);
          if (row.lux != null) updateSensor('light', row.lux);
          checkCriticalAlerts(row.soil_moisture, row.temperature);

          const isHardware = Boolean(
            row.device_id &&
            !row.device_id.includes('demo') &&
            !row.device_id.includes('remedy') &&
            (row.device_id.startsWith('esp32') || row.device_id.startsWith('agrisense-') || row.device_id === 'agrisense-lan') &&
            (Date.now() - new Date(row.recorded_at).getTime() < 45000)
          );

          useStore.setState({
            lastSync: new Date(),
            realtimeStatus: 'connected',
            telemetrySource: isHardware ? 'hardware' : 'simulated',
            lastHardwarePacketAt: isHardware ? new Date(row.recorded_at).getTime() : null,
          });
        }
      } catch (err) {
        console.error("Error fetching initial database state:", err);
      }
    };

    fetchInitialData();

    const handleNewReading = (row: SensorReading) => {
      lastKnownReadingId.current = row.id;
      if (row.soil_moisture != null) updateSensor('soilMoisture', row.soil_moisture);
      if (row.temperature != null) updateSensor('temperature', row.temperature);
      if (row.humidity != null) updateSensor('humidity', row.humidity);
      if (row.lux != null) updateSensor('light', row.lux);
      checkCriticalAlerts(row.soil_moisture, row.temperature);

      useStore.getState().incrementPacketCount?.();

      const isHardware = Boolean(
        row.device_id &&
        !row.device_id.includes('demo') &&
        !row.device_id.includes('remedy') &&
        (row.device_id.startsWith('esp32') || row.device_id.startsWith('agrisense-') || row.device_id === 'agrisense-lan')
      );

      useStore.setState({ 
        lastSync: new Date(),
        realtimeStatus: 'connected',
        telemetrySource: isHardware ? 'hardware' : 'simulated',
        lastHardwarePacketAt: isHardware ? Date.now() : useStore.getState().lastHardwarePacketAt,
      });
    };

    const sensorChannel = supabase
      .channel('sensor_readings_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          handleNewReading(payload.new as SensorReading);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          handleNewReading(payload.new as SensorReading);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          useStore.setState({ realtimeStatus: 'connected', lastSync: new Date() });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          useStore.setState({ realtimeStatus: 'disconnected' });
        }
      });

    const tablesChannel = supabase
      .channel('system_tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => {
        supabase.from('nodes').select('*').order('id').then(({ data }) => data && setNodes(data));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        supabase.from('profiles').select('*').order('name').then(({ data }) => data && setProfiles(data));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(30)
          .then(({ data }) => data && setActivity(data));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'plant_info' }, () => {
        supabase.from('plant_info').select('*').limit(1).single()
          .then(({ data }) => data && setPlant({ age: data.age, harvestAge: data.harvest_age }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_settings' }, () => {
        supabase.from('sensor_settings').select('*').then(({ data }) => data && setThresholds(data));
      })
      .subscribe();

    channelsRef.current = [sensorChannel, tablesChannel];

    const pollSupabase = async () => {
      try {
        const { data } = await supabase
          .from('sensor_readings')
          .select('*')
          .order('recorded_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const row = data[0] as SensorReading;
          if (lastKnownReadingId.current === null) {
            lastKnownReadingId.current = row.id;
            useStore.setState({ realtimeStatus: 'connected' });
          } else if (lastKnownReadingId.current !== row.id) {
            handleNewReading(row);
          } else {
            useStore.setState({ realtimeStatus: 'connected' });
          }
        }
      } catch {}
    };
    const supabaseInterval = setInterval(pollSupabase, 3000);

    const pollLan = async () => {
      const { lanPolling, lanIp } = useStore.getState();
      if (!lanPolling || !lanIp) return;
      const cleanIp = lanIp.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!cleanIp) return;

      const startMs = Date.now();
      try {
        let data: any = null;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          const res = await fetch(`/api/lan-poller?ip=${encodeURIComponent(cleanIp)}`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            data = await res.json();
            useStore.getState().setStreamLatency?.(Date.now() - startMs);
          }
        } catch {}

        if (!data) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);
            const directRes = await fetch(`http://${cleanIp}/api/readings`, {
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (directRes.ok) {
              data = await directRes.json();
              useStore.getState().setStreamLatency?.(Date.now() - startMs);
            }
          } catch {}
        }

        if (data && (data.soilMoisture != null || data.temperature != null)) {
          if (data.soilMoisture != null) updateSensor('soilMoisture', data.soilMoisture);
          if (data.temperature != null) updateSensor('temperature', data.temperature);
          if (data.humidity != null) updateSensor('humidity', data.humidity);
          if (data.lux != null) updateSensor('light', data.lux);
          checkCriticalAlerts(data.soilMoisture, data.temperature);

          useStore.getState().incrementPacketCount?.();
          const now = new Date();
          useStore.setState({
            lastSync: now,
            realtimeStatus: 'connected',
            telemetrySource: 'hardware',
            lastHardwarePacketAt: now.getTime(),
          });

          const nowMs = now.getTime();
          if (nowMs - lastLanDbInsertMs.current > 15000) {
            lastLanDbInsertMs.current = nowMs;
            supabase.from('sensor_readings').insert([{
              device_id: data.device_id || 'agrisense-lan',
              soil_moisture: data.soilMoisture,
              temperature: data.temperature,
              humidity: data.humidity,
              lux: data.lux,
            }]).then();
          }
        }
      } catch {}
    };

    const lanInterval = setInterval(pollLan, 2500);

    const watchdogInterval = setInterval(() => {
      const { lastSync } = useStore.getState();
      if (lastSync) {
        const diffMs = Date.now() - new Date(lastSync).getTime();
        if (diffMs > 180000) {
          useStore.setState({ realtimeStatus: 'disconnected' });
        }
      }
    }, 10000);

    return () => {
      clearInterval(supabaseInterval);
      clearInterval(lanInterval);
      clearInterval(watchdogInterval);
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      useStore.setState({ realtimeStatus: 'disconnected' });
    };
  }, []);
}
