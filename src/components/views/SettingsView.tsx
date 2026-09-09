"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

const PRESETS: Record<string, { label: string; description: string; values: Record<string, { min: number; max: number }> }> = {
  standard: {
    label: "Standard Aloe Vera",
    description: "Ideal year-round baseline for mature Aloe Barbadensis.",
    values: {
      soilMoisture: { min: 20, max: 40 },
      temperature: { min: 25, max: 32 },
      humidity: { min: 40, max: 70 },
      light: { min: 10000, max: 20000 },
    },
  },
  drySeason: {
    label: "Dry Season / Arid",
    description: "Reduced moisture targets to avoid root rot in high ambient temperatures.",
    values: {
      soilMoisture: { min: 15, max: 30 },
      temperature: { min: 28, max: 36 },
      humidity: { min: 30, max: 60 },
      light: { min: 15000, max: 25000 },
    },
  },
  rainySeason: {
    label: "Rainy / Monsoon",
    description: "Tolerates higher humidity with alert triggers for soil saturation.",
    values: {
      soilMoisture: { min: 25, max: 50 },
      temperature: { min: 22, max: 29 },
      humidity: { min: 55, max: 85 },
      light: { min: 8000, max: 18000 },
    },
  },
  nursery: {
    label: "Nursery / Seedlings",
    description: "Gentler lighting and higher humidity for aloe pups and young offsets.",
    values: {
      soilMoisture: { min: 30, max: 55 },
      temperature: { min: 24, max: 30 },
      humidity: { min: 50, max: 75 },
      light: { min: 6000, max: 14000 },
    },
  },
};

export function SettingsView() {
  const { role, sensors, plant, setPlant, addActivity, setThresholds, audioAlertsEnabled, setAudioAlertsEnabled, playAlertChime } = useStore();
  const isAdmin = role === "admin";

  const [plantAge, setLocalPlantAge] = useState(plant.age || 180);
  const [harvestAge, setLocalHarvestAge] = useState(plant.harvestAge || 365);
  const [savingPlant, setSavingPlant] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("standard");

  useEffect(() => {
    setLocalPlantAge(plant.age);
    setLocalHarvestAge(plant.harvestAge);
  }, [plant.age, plant.harvestAge]);

  const handleUpdate = async (id: string, field: "optimal_min" | "optimal_max", value: number) => {
    try {
      const { error } = await supabase
        .from("sensor_settings")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      addActivity(`Updated ${id} ${field} to ${value}`, "info");
    } catch (err: any) {
      console.error("Failed to update setting", err);
      addActivity(`Failed to update ${id}: ${err.message}`, "warning");
    }
  };

  const handleApplyPreset = async (key: string) => {
    if (!isAdmin) return;
    setSelectedPreset(key);
    const preset = PRESETS[key];
    if (!preset) return;

    try {
      const updates = Object.entries(preset.values).map(([id, range]) => ({
        id,
        optimal_min: range.min,
        optimal_max: range.max,
        updated_at: new Date().toISOString(),
      }));

      for (const u of updates) {
        await supabase.from("sensor_settings").upsert(u);
      }

      setThresholds(updates);
      addActivity(`Applied threshold preset: ${preset.label}`, "info");
    } catch (e: any) {
      alert(`Could not apply preset: ${e?.message}`);
    }
  };

  const handleSavePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlant(true);
    try {
      setPlant({ age: plantAge, harvestAge });
      const { error } = await supabase.from("plant_info").upsert([
        {
          id: 1,
          age: plantAge,
          harvest_age: harvestAge,
        },
      ]);
      if (error) throw error;
      addActivity(`Updated crop timeline: ${plantAge} days / ${harvestAge} days target`, "ok");
    } catch (err: any) {
      console.warn("Failed to persist plant_info to DB:", err?.message);
      addActivity("Updated local crop settings", "info");
    } finally {
      setSavingPlant(false);
    }
  };

  return (
    <section className="p-8 space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Optimal Sensor Thresholds</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? "Configure target operating ranges. Out-of-bounds readings generate real-time alerts."
                : "Reference guide for optimal greenhouse environmental parameters."}
            </p>
          </div>
          {isAdmin && (
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full shrink-0">
              <i className="fa-solid fa-pen-to-square mr-1"></i> Edit Mode Active
            </span>
          )}
        </div>

        {isAdmin && (
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Quick Season & Cultivation Presets
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleApplyPreset(k)}
                  className={`p-3 rounded-xl border text-left transition ${
                    selectedPreset === k
                      ? "bg-agri-50 border-agri-500 ring-2 ring-agri-500/20"
                      : "bg-white border-slate-200 hover:border-agri-300"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{p.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-3 divide-y divide-slate-100">
          {Object.values(sensors).map((s) => (
            <ThresholdRow key={s.id} s={s} isAdmin={isAdmin} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Crop Cultivation Timeline</h3>
        <p className="text-xs text-slate-500 mb-5">
          Configure crop growth duration and projected harvest readiness milestones.
        </p>

        <form onSubmit={handleSavePlant} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Current Plant Age (Days)
            </label>
            <input
              type="number"
              min="0"
              max="1000"
              value={plantAge}
              onChange={(e) => setLocalPlantAge(Number(e.target.value))}
              disabled={!isAdmin}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target Harvest Age (Days)
            </label>
            <input
              type="number"
              min="1"
              max="1500"
              value={harvestAge}
              onChange={(e) => setLocalHarvestAge(Number(e.target.value))}
              disabled={!isAdmin}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 disabled:bg-slate-50"
            />
          </div>

          {isAdmin && (
            <button
              type="submit"
              disabled={savingPlant}
              className="px-5 py-2.5 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              {savingPlant ? "Saving…" : "Update Timeline"}
            </button>
          )}
        </form>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-2xl ${audioAlertsEnabled ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"} flex items-center justify-center shrink-0`}>
              <i className={`fa-solid ${audioAlertsEnabled ? "fa-bell text-lg" : "fa-bell-slash text-lg"}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Audio Chime & Warning Notifications</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${audioAlertsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {audioAlertsEnabled ? "Active" : "Muted"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                Synthesizes instant browser warning chimes when aloe vera parameters reach hazard levels (Moisture &lt; 10% severe dehydration, &gt; 65% root rot danger, Temperature &gt; 38°C extreme heat).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => playAlertChime("info")}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-volume-high text-xs"></i> Test Gentle Tone
            </button>
            <button
              type="button"
              onClick={() => playAlertChime("critical")}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> Test Critical Alert
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !audioAlertsEnabled;
                setAudioAlertsEnabled(next);
                addActivity(`Audio alerts ${next ? "enabled" : "muted"}`, "info");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                audioAlertsEnabled
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              <i className={`fa-solid ${audioAlertsEnabled ? "fa-toggle-on" : "fa-toggle-off"} text-sm`}></i>
              {audioAlertsEnabled ? "Disable Audio" : "Enable Audio"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ThresholdRow({
  s,
  isAdmin,
  onUpdate,
}: {
  s: any;
  isAdmin: boolean;
  onUpdate: (id: string, f: "optimal_min" | "optimal_max", v: number) => void;
}) {
  const [min, setMin] = useState(s.optimal.min);
  const [max, setMax] = useState(s.optimal.max);

  useEffect(() => {
    setMin(s.optimal.min);
    setMax(s.optimal.max);
  }, [s.optimal.min, s.optimal.max]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-4">
      <div className="sm:col-span-4 flex items-center gap-3.5">
        <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0 shadow-xs`}>
          <i className={`fa-solid ${s.icon} ${s.iconColor} text-sm`}></i>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{s.label}</p>
          <p className="text-xs text-slate-500 font-mono">Unit: {s.unit === "lux" ? "lux" : s.unit}</p>
        </div>
      </div>

      <div className="sm:col-span-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Minimum Optimal ({s.unit})
        </label>
        <input
          type="number"
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          onBlur={() => {
            if (min !== s.optimal.min) onUpdate(s.id, "optimal_min", min);
          }}
          disabled={!isAdmin}
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:opacity-75"
        />
      </div>

      <div className="sm:col-span-4">
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Maximum Optimal ({s.unit})
        </label>
        <input
          type="number"
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          onBlur={() => {
            if (max !== s.optimal.max) onUpdate(s.id, "optimal_max", max);
          }}
          disabled={!isAdmin}
          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:opacity-75"
        />
      </div>
    </div>
  );
}
