import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/utils';


export type Role = "farmer" | "admin";
export type AlertTone = "ok" | "info" | "warning" | "critical";

export interface SensorData {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  decimals: number;
  optimal: { min: number; max: number };
  icon: string;
  iconBg: string;
  iconColor: string;
  barColor: string;
}

export interface ActivityItem {
  time: string;
  text: string;
  tone: AlertTone;
}

export interface NodeItem {
  id: string;
  zone: string;
  type: string;
  battery: number;
  signal: number;
  online: boolean;
}

export interface ProfileItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface FarmLocation {
  name: string;
  country: string;
  lat: number;
  lon: number;
  region?: string;
  isGps?: boolean;
}

export interface FarmSettings {
  potSize: 'small' | 'medium' | 'large_ground';
  sunExposure: 'full' | 'partial' | 'shaded';
  soilType: 'fast_draining' | 'standard' | 'clay';
}

interface AppState {
  role: Role;
  auth: {
    isAuthenticated: boolean;
    currentUser: { id: string; name: string; email: string; role: Role } | null;
  };
  sensors: Record<string, SensorData>;
  plant: { age: number; harvestAge: number };
  activity: ActivityItem[];
  nodes: NodeItem[];
  profiles: ProfileItem[];
  lastSync: Date;
  isSyncing: boolean;
  lanIp: string;
  lanPolling: boolean;
  analyticsRange: string;
  dismissedAlerts: Set<string>;

  realtimeStatus: "connected" | "disconnected";
  telemetrySource: "simulated" | "hardware";
  lastHardwarePacketAt: number | null;
  currentView: string;

  farmLocation: FarmLocation;
  farmSettings: FarmSettings;
  manualWateringDays: number | null;
  lastWateredDate: string | null;

  criticalAlertSettings: {
    minSoilMoisture: number;
    maxSoilMoisture: number;
    maxTemp: number;
    minTemp: number;
  };
  setCriticalAlertSettings: (settings: Partial<{ minSoilMoisture: number; maxSoilMoisture: number; maxTemp: number; minTemp: number }>) => void;
  setTelemetrySource: (source: "simulated" | "hardware") => void;

  setCurrentView: (view: string) => void;
  setRole: (role: Role) => void;
  updateSensor: (id: string, value: number) => void;
  dismissAlert: (id: string) => void;
  addActivity: (text: string, tone?: AlertTone) => Promise<void>;
  setSession: (user: any) => void;
  clearSession: () => void;
  logout: () => Promise<void>;

  setNodes: (nodes: NodeItem[]) => void;
  setProfiles: (profiles: ProfileItem[]) => void;
  setPlant: (plant: { age: number; harvestAge: number }) => void;
  setActivity: (activity: ActivityItem[]) => void;
  setThresholds: (thresholds: Array<{ id: string; optimal_min: number; optimal_max: number }>) => void;

  setFarmLocation: (loc: FarmLocation) => void;
  setFarmSettings: (settings: Partial<FarmSettings>) => void;
  setManualWateringDays: (days: number | null) => void;
  recordWatering: () => Promise<void>;

  setLanIp: (ip: string) => void;
  setLanPolling: (enabled: boolean) => void;
  syncNow: () => Promise<void>;
  audioAlertsEnabled: boolean;
  setAudioAlertsEnabled: (enabled: boolean) => void;
  playAlertChime: (type?: "info" | "critical" | "test") => void;

  livePacketCount: number;
  streamLatency: number | null;
  incrementPacketCount: () => void;
  setStreamLatency: (ms: number | null) => void;
}

const DEFAULT_SENSORS: Record<string, SensorData> = {
  soilMoisture: {
    id: "soilMoisture",
    label: "Soil Moisture",
    value: 18,
    unit: "%",
    min: 0,
    max: 100,
    decimals: 0,
    optimal: { min: 20, max: 40 },
    icon: "fa-droplet",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    barColor: "bg-amber-400",
  },
  temperature: {
    id: "temperature",
    label: "Temperature",
    value: 28,
    unit: "°C",
    min: 0,
    max: 50,
    decimals: 0,
    optimal: { min: 25, max: 32 },
    icon: "fa-temperature-half",
    iconBg: "bg-agri-50",
    iconColor: "text-agri-600",
    barColor: "bg-agri-500",
  },
  humidity: {
    id: "humidity",
    label: "Humidity",
    value: 65,
    unit: "%",
    min: 0,
    max: 100,
    decimals: 0,
    optimal: { min: 40, max: 70 },
    icon: "fa-cloud",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-500",
    barColor: "bg-sky-400",
  },
  light: {
    id: "light",
    label: "Light Intensity",
    value: 15000,
    unit: "lux",
    min: 0,
    max: 25000,
    decimals: 0,
    optimal: { min: 10000, max: 20000 },
    icon: "fa-sun",
    iconBg: "bg-yellow-50",
    iconColor: "text-yellow-500",
    barColor: "bg-yellow-400",
  },
};

export const useStore = create<AppState>((set) => ({
  role: "farmer",
  auth: {
    isAuthenticated: false,
    currentUser: null,
  },
  sensors: typeof window !== "undefined" && localStorage.getItem("agrisense_sensor_thresholds")
    ? (() => {
        try {
          const saved = JSON.parse(localStorage.getItem("agrisense_sensor_thresholds")!);
          const res = { ...DEFAULT_SENSORS };
          Object.keys(saved).forEach((k) => {
            if (res[k]) {
              res[k] = { ...res[k], optimal: saved[k] };
            }
          });
          return res;
        } catch {
          return DEFAULT_SENSORS;
        }
      })()
    : DEFAULT_SENSORS,
  plant: typeof window !== "undefined" && localStorage.getItem("agrisense_plant_info")
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem("agrisense_plant_info")!);
        } catch {
          return { age: 180, harvestAge: 240 };
        }
      })()
    : { age: 180, harvestAge: 240 },
  criticalAlertSettings: typeof window !== "undefined" && localStorage.getItem("agrisense_critical_settings")
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem("agrisense_critical_settings")!);
        } catch {
          return { minSoilMoisture: 10, maxSoilMoisture: 65, maxTemp: 38, minTemp: 12 };
        }
      })()
    : { minSoilMoisture: 10, maxSoilMoisture: 65, maxTemp: 38, minTemp: 12 },
  telemetrySource: "simulated",
  lastHardwarePacketAt: null,
  activity: [],
  nodes: [],
  profiles: [],
  lastSync: new Date(),
  isSyncing: false,
  lanIp: typeof window !== "undefined" ? (localStorage.getItem("agrisense_esp32_ip") || "192.168.1.42") : "192.168.1.42",
  lanPolling: typeof window !== "undefined" ? (localStorage.getItem("agrisense_lan_polling") === "true") : false,
  analyticsRange: "7d",
  dismissedAlerts: new Set(),
  realtimeStatus: "disconnected",
  currentView: "dashboard",
  livePacketCount: 0,
  streamLatency: null,

  incrementPacketCount: () => set((state) => ({ livePacketCount: state.livePacketCount + 1 })),
  setStreamLatency: (ms: number | null) => set({ streamLatency: ms }),

  setCurrentView: (view) => set({ currentView: view }),
  setRole: (role) => set({ role }),
  updateSensor: (id, value) => set((state) => ({
    livePacketCount: state.livePacketCount + 1,
    sensors: {
      ...state.sensors,
      [id]: { ...state.sensors[id], value }
    }
  })),
  dismissAlert: (id) => set((state) => {
    const newDismissed = new Set(state.dismissedAlerts);
    newDismissed.add(id);
    return { dismissedAlerts: newDismissed };
  }),
  addActivity: async (text, tone = "info") => {
    const timeStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const newItem = { time: timeStr, text, tone };

    set((state) => {
      const newActivity = [newItem, ...state.activity].slice(0, 30);
      return { activity: newActivity };
    });

    try {
      await supabase.from('activity_logs').insert([{ time: timeStr, text, tone }]);
    } catch (err) {
      console.error('[addActivity] Failed to persist to DB:', err);
    }
  },
  setSession: (user) => set((state) => ({
    role: user.role || "farmer",
    auth: {
      ...state.auth,
      isAuthenticated: true,
      currentUser: {
        id: user.id,
        name: user.name || user.email?.split('@')[0] || "User",
        email: user.email,
        role: user.role || "farmer",
      },
    }
  })),
  clearSession: () => set((state) => ({
    role: "farmer",
    auth: {
      ...state.auth,
      isAuthenticated: false,
      currentUser: null,
    }
  })),
  logout: async () => {
    await supabase.auth.signOut();
    set((state) => ({
      role: "farmer",
      auth: {
        ...state.auth,
        isAuthenticated: false,
        currentUser: null,
      }
    }));
  },

  farmLocation: typeof window !== "undefined" && localStorage.getItem("agrisense_detected_location")
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem("agrisense_detected_location")!);
        } catch {
          return { name: "Manila", country: "PH", lat: 14.5995, lon: 120.9842, region: "NCR / Central Luzon" };
        }
      })()
    : {
        name: "Manila",
        country: "PH",
        lat: 14.5995,
        lon: 120.9842,
        region: "NCR / Central Luzon",
      },
  farmSettings: {
    potSize: "medium",
    sunExposure: "partial",
    soilType: "standard",
  },
  manualWateringDays: null,
  lastWateredDate: null,

  setNodes: (nodes) => set({ nodes }),
  setProfiles: (profiles) => set({ profiles }),
  setPlant: (plant) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agrisense_plant_info", JSON.stringify(plant));
    }
    set({ plant });
  },
  setActivity: (activity) => set({ activity }),
  setThresholds: (thresholds) => set((state) => {
    const updatedSensors = { ...state.sensors };
    const savedMap: Record<string, { min: number; max: number }> = {};
    thresholds.forEach((t) => {
      if (updatedSensors[t.id]) {
        updatedSensors[t.id] = {
          ...updatedSensors[t.id],
          optimal: { min: t.optimal_min, max: t.optimal_max },
        };
        savedMap[t.id] = { min: t.optimal_min, max: t.optimal_max };
      }
    });
    if (typeof window !== "undefined") {
      try {
        const existing = JSON.parse(localStorage.getItem("agrisense_sensor_thresholds") || "{}");
        localStorage.setItem("agrisense_sensor_thresholds", JSON.stringify({ ...existing, ...savedMap }));
      } catch {}
    }
    return { sensors: updatedSensors };
  }),
  setCriticalAlertSettings: (settings) => set((state) => {
    const updated = { ...state.criticalAlertSettings, ...settings };
    if (typeof window !== "undefined") {
      localStorage.setItem("agrisense_critical_settings", JSON.stringify(updated));
    }
    return { criticalAlertSettings: updated };
  }),
  setTelemetrySource: (source) => set({ telemetrySource: source }),

  setFarmLocation: (loc) => set({ farmLocation: loc }),
  setFarmSettings: (settings) => set((state) => ({
    farmSettings: { ...state.farmSettings, ...settings },
  })),
  setManualWateringDays: (days) => set({ manualWateringDays: days }),
  recordWatering: async () => {
    const now = new Date().toISOString();
    set((state) => ({
      lastWateredDate: now,
      manualWateringDays: 0,
      sensors: {
        ...state.sensors,
        soilMoisture: {
          ...state.sensors.soilMoisture,
          value: Math.max(state.sensors.soilMoisture.value, 35),
        },
      },
    }));
    await useStore.getState().addActivity("Aloe vera watered — drought counter reset to Day 0", "ok");
  },

  setLanIp: (ip: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agrisense_esp32_ip", ip);
    }
    set({ lanIp: ip });
  },

  setLanPolling: (polling: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agrisense_lan_polling", polling ? "true" : "false");
    }
    set({ lanPolling: polling });
  },

  syncNow: async () => {
    const { updateSensor, addActivity, setNodes, setPlant, setActivity, lanIp } = useStore.getState();
    set({ isSyncing: true });

    let lanSuccess = false;
    let dbSuccess = false;

    const cleanIp = (lanIp || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

    const fetchLan = async () => {
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
            set({ streamLatency: Date.now() - startMs });
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
              set({ streamLatency: Date.now() - startMs });
            }
          } catch {}
        }

        if (data && (data.soilMoisture != null || data.temperature != null)) {
          if (data.soilMoisture != null) updateSensor('soilMoisture', data.soilMoisture);
          if (data.temperature != null) updateSensor('temperature', data.temperature);
          if (data.humidity != null) updateSensor('humidity', data.humidity);
          if (data.lux != null) updateSensor('light', data.lux);

          lanSuccess = true;

          supabase.from('sensor_readings').insert([{
            device_id: data.device_id || 'agrisense-lan',
            soil_moisture: data.soilMoisture,
            temperature: data.temperature,
            humidity: data.humidity,
            lux: data.lux,
          }]).then();
        }
      } catch {}
    };

    const fetchDb = async () => {
      try {
        const [
          { data: readingsData },
          { data: plantData },
          { data: activityData },
          { data: nodesData }
        ] = await Promise.all([
          supabase.from('sensor_readings').select('*').order('recorded_at', { ascending: false }).limit(1),
          supabase.from('plant_info').select('*').limit(1).single(),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(30),
          supabase.from('nodes').select('*').order('id')
        ]);

        if (plantData) setPlant({ age: plantData.age, harvestAge: plantData.harvest_age });
        if (activityData) setActivity(activityData);
        if (nodesData) setNodes(nodesData);

        if (readingsData && readingsData.length > 0) {
          const r = readingsData[0];
          if (!lanSuccess) {
            if (r.soil_moisture != null) updateSensor('soilMoisture', r.soil_moisture);
            if (r.temperature != null) updateSensor('temperature', r.temperature);
            if (r.humidity != null) updateSensor('humidity', r.humidity);
            const luxVal = r.lux != null ? r.lux : r.light_lux;
            if (luxVal != null) updateSensor('light', luxVal);
          }
          dbSuccess = true;
        }
      } catch (err) {
        console.warn('[syncNow] DB sync error:', err);
      }
    };

    await Promise.all([fetchLan(), fetchDb()]);

    const now = new Date();
    set({
      isSyncing: false,
      lastSync: now,
      realtimeStatus: lanSuccess || dbSuccess ? 'connected' : 'disconnected',
    });

    if (lanSuccess) {
      addActivity(`Live telemetry refreshed from ESP32 (${cleanIp})`, 'ok');
      showToast(`Synced with ESP32 (${cleanIp})`, 'ok');
    } else if (dbSuccess) {
      addActivity('Telemetry and crop records refreshed from cloud database', 'ok');
      showToast('Telemetry refreshed from cloud database', 'ok');
    } else {
      showToast('Could not reach sensor or database', 'warning');
    }
  },

  audioAlertsEnabled: typeof window !== "undefined" ? localStorage.getItem("agrisense_audio_alerts") !== "false" : true,

  setAudioAlertsEnabled: (enabled: boolean) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("agrisense_audio_alerts", enabled ? "true" : "false");
    }
    set({ audioAlertsEnabled: enabled });
  },

  playAlertChime: (type = "info") => {
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const now = ctx.currentTime;
      if (type === "critical") {
        // High-urgency alarm siren: alternating multi-tone pulsing warble
        const pulses = [
          { f: 987.77, dur: 0.16 }, // B5
          { f: 783.99, dur: 0.16 }, // G5
          { f: 987.77, dur: 0.16 }, // B5
          { f: 783.99, dur: 0.24 }, // G5 with hold
        ];
        let offset = 0;
        pulses.forEach((p) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(p.f, now + offset);
          gain.gain.setValueAtTime(0.22, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + p.dur - 0.02);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + p.dur);
          offset += p.dur;
        });
      } else {
        const freqs = [587.33, 880];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.16);
          gain.gain.setValueAtTime(0.15, now + idx * 0.16);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.16 + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.16);
          osc.stop(now + idx * 0.16 + 0.22);
        });
      }
    } catch {}
  },
}));
