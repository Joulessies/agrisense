import { create } from 'zustand';
import { supabase } from '@/lib/supabase';


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
  analyticsRange: string;
  dismissedAlerts: Set<string>;
  
  realtimeStatus: "connected" | "disconnected";
  currentView: string;
  
  // Actions
  setCurrentView: (view: string) => void;
  setRole: (role: Role) => void;
  updateSensor: (id: string, value: number) => void;
  dismissAlert: (id: string) => void;
  addActivity: (text: string, tone?: AlertTone) => Promise<void>;
  setSession: (user: any) => void;
  clearSession: () => void;
  logout: () => Promise<void>;
  
  // DB Sync Actions
  setNodes: (nodes: NodeItem[]) => void;
  setProfiles: (profiles: ProfileItem[]) => void;
  setPlant: (plant: { age: number; harvestAge: number }) => void;
  setActivity: (activity: ActivityItem[]) => void;
  setThresholds: (thresholds: Array<{ id: string; optimal_min: number; optimal_max: number }>) => void;
}

export const useStore = create<AppState>((set) => ({
  role: "farmer",
  auth: {
    isAuthenticated: false,
    currentUser: null,
  },
  sensors: {
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
  },
  plant: { age: 0, harvestAge: 0 },
  activity: [],
  nodes: [],
  profiles: [],
  lastSync: new Date(),
  analyticsRange: "7d",
  dismissedAlerts: new Set(),
  realtimeStatus: "disconnected",
  currentView: "dashboard",

  setCurrentView: (view) => set({ currentView: view }),
  setRole: (role) => set({ role }),
  updateSensor: (id, value) => set((state) => ({
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
    // Optimistic update
    set((state) => {
      const newActivity = [{ time: timeStr, text, tone }, ...state.activity].slice(0, 30);
      return { activity: newActivity };
    });
    // Purely local optimistic UI update for any manual alerts.
    // DB-generated alerts arrive via Realtime instead.
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
  },
  
  setNodes: (nodes) => set({ nodes }),
  setProfiles: (profiles) => set({ profiles }),
  setPlant: (plant) => set({ plant }),
  setActivity: (activity) => set({ activity }),
  setThresholds: (thresholds) => set((state) => {
    const updatedSensors = { ...state.sensors };
    thresholds.forEach((t) => {
      if (updatedSensors[t.id]) {
        updatedSensors[t.id] = {
          ...updatedSensors[t.id],
          optimal: { min: t.optimal_min, max: t.optimal_max },
        };
      }
    });
    return { sensors: updatedSensors };
  }),
}));
