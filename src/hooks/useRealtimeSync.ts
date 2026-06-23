'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

interface SensorReading {
  id: string;
  recorded_at: string;
  device_id: string;
  soil_moisture: number | null;
  temperature: number | null;
  humidity: number | null;
  light_lux: number | null;
}

export function useRealtimeSync() {
  const { updateSensor, addActivity, setNodes, setProfiles, setPlant, setActivity, setThresholds } = useStore();
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return;
    }

    // 1. Fetch initial data
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
          if (row.soil_moisture != null) updateSensor('soilMoisture', row.soil_moisture);
          if (row.temperature != null) updateSensor('temperature', row.temperature);
          if (row.humidity != null) updateSensor('humidity', row.humidity);
          if (row.lux != null) updateSensor('light', row.lux);
        }
      } catch (err) {
        console.error("Error fetching initial database state:", err);
      }
    };

    fetchInitialData();

    // 2. Setup Realtime subscriptions
    const sensorChannel = supabase
      .channel('sensor_readings_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_readings' },
        (payload) => {
          const row = payload.new as SensorReading;
          if (row.soil_moisture != null) updateSensor('soilMoisture', row.soil_moisture);
          if (row.temperature != null) updateSensor('temperature', row.temperature);
          if (row.humidity != null) updateSensor('humidity', row.humidity);
          if (row.light_lux != null || (row as any).lux != null) updateSensor('light', row.light_lux ?? (row as any).lux);

          useStore.setState({ lastSync: new Date() });
          addActivity(
            `Live update from ${row.device_id ?? 'sensor'}: moisture ${row.soil_moisture ?? '—'}%, temp ${row.temperature ?? '—'}°C`,
            'info'
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          useStore.setState({ realtimeStatus: 'connected' });
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

    return () => {
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      useStore.setState({ realtimeStatus: 'disconnected' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
