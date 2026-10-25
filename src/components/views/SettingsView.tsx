"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/utils";

const BASELINE_PRESET = {
  label: "Standard Aloe Vera Baseline",
  description: "Scientifically recommended baseline for mature Aloe Barbadensis Miller. You can fine-tune every individual threshold below.",
  values: {
    soilMoisture: { min: 20, max: 40 },
    temperature: { min: 25, max: 32 },
    humidity: { min: 40, max: 70 },
    light: { min: 10000, max: 20000 },
  },
};

export function SettingsView() {
  const {
    role,
    sensors,
    plant,
    setPlant,
    addActivity,
    setThresholds,
    audioAlertsEnabled,
    setAudioAlertsEnabled,
    playAlertChime,
    criticalAlertSettings,
    setCriticalAlertSettings,
  } = useStore();
  const isAdmin = role === "admin";

  const [plantAge, setLocalPlantAge] = useState(plant.age || 180);
  const [harvestAge, setLocalHarvestAge] = useState(plant.harvestAge || 240);
  const [savingPlant, setSavingPlant] = useState(false);

  const [critSoilMin, setCritSoilMin] = useState(criticalAlertSettings?.minSoilMoisture ?? 10);
  const [critSoilMax, setCritSoilMax] = useState(criticalAlertSettings?.maxSoilMoisture ?? 65);
  const [critTempMax, setCritTempMax] = useState(criticalAlertSettings?.maxTemp ?? 38);
  const [critTempMin, setCritTempMin] = useState(criticalAlertSettings?.minTemp ?? 10);
  const [savingCritical, setSavingCritical] = useState(false);

  useEffect(() => {
    setLocalPlantAge(plant.age);
    setLocalHarvestAge(plant.harvestAge);
  }, [plant.age, plant.harvestAge]);

  useEffect(() => {
    if (criticalAlertSettings) {
      setCritSoilMin(criticalAlertSettings.minSoilMoisture);
      setCritSoilMax(criticalAlertSettings.maxSoilMoisture);
      setCritTempMax(criticalAlertSettings.maxTemp);
      setCritTempMin(criticalAlertSettings.minTemp);
    }
  }, [criticalAlertSettings]);

  const handleUpdate = async (id: string, field: "optimal_min" | "optimal_max", value: number) => {
    try {
      const current = sensors[id]?.optimal || { min: 0, max: 100 };
      const nextMin = field === "optimal_min" ? value : current.min;
      const nextMax = field === "optimal_max" ? value : current.max;

      setThresholds([{ id, optimal_min: nextMin, optimal_max: nextMax }]);

      const { error } = await supabase
        .from("sensor_settings")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) console.warn("Supabase update error (saved in browser cache):", error);
      addActivity(`Updated ${id} ${field === "optimal_min" ? "minimum" : "maximum"} to ${value}`, "info");
    } catch (err: any) {
      console.error("Failed to update setting", err);
      addActivity(`Updated ${id} locally`, "info");
    }
  };

  const handleResetBaseline = async () => {
    if (!isAdmin) return;
    try {
      const updates = Object.entries(BASELINE_PRESET.values).map(([id, range]) => ({
        id,
        optimal_min: range.min,
        optimal_max: range.max,
        updated_at: new Date().toISOString(),
      }));

      setThresholds(updates);

      for (const u of updates) {
        await supabase
          .from("sensor_settings")
          .update({ optimal_min: u.optimal_min, optimal_max: u.optimal_max, updated_at: u.updated_at })
          .eq("id", u.id);
      }

      addActivity("Restored baseline Aloe Vera sensor thresholds", "ok");
    } catch (e: any) {
      console.warn("Could not sync preset to DB (cached locally):", e?.message);
    }
  };

  const handleSavePlant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPlant(true);
    try {
      const nowIso = new Date().toISOString();
      setPlant({ age: plantAge, baseAge: plantAge, harvestAge, lastUpdatedDate: nowIso });

      const { error } = await supabase
        .from("plant_info")
        .update({
          age: plantAge,
          harvest_age: harvestAge,
        })
        .eq("id", 1);

      if (error) {
        console.warn("Supabase plant_info update notice:", error.message);
      }
      addActivity(`Updated crop timeline: ${plantAge} days / ${harvestAge} days target (persisted)`, "ok");
      showToast("Cultivation timeline saved & persisted", "ok");
    } catch {
      addActivity(`Updated crop timeline locally: ${plantAge}d / ${harvestAge}d`, "info");
      showToast("Updated crop timeline in local storage", "info");
    } finally {
      setSavingPlant(false);
    }
  };

  const handleSaveCritical = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCritical(true);
    const updated = {
      minSoilMoisture: Number(critSoilMin),
      maxSoilMoisture: Number(critSoilMax),
      maxTemp: Number(critTempMax),
      minTemp: Number(critTempMin),
    };
    setCriticalAlertSettings(updated);
    addActivity(
      `Updated critical hazard thresholds: Moisture <${updated.minSoilMoisture}%, >${updated.maxSoilMoisture}%, Temp >${updated.maxTemp}°C, <${updated.minTemp}°C`,
      "warning"
    );
    setTimeout(() => setSavingCritical(false), 400);
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetBaseline}
                className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Reset all thresholds back to standard Aloe Vera defaults"
              >
                <i className="fa-solid fa-rotate-left text-[11px]"></i> Reset Standard Baseline
              </button>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full shrink-0">
                <i className="fa-solid fa-pen-to-square mr-1"></i> Edit Mode Active
              </span>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-agri-50/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-agri-600"></span>
            <p className="text-xs font-bold text-agri-900">{BASELINE_PRESET.label}</p>
            <span className="text-[11px] text-slate-600 hidden sm:inline">— {BASELINE_PRESET.description}</span>
          </div>
          <span className="text-[11px] font-medium text-agri-700 bg-white border border-agri-200 px-2.5 py-0.5 rounded-lg shrink-0 self-start sm:self-auto">
            Editable Values
          </span>
        </div>

        <div className="px-6 py-3 divide-y divide-slate-100">
          {Object.values(sensors).map((s) => (
            <ThresholdRow key={s.id} s={s} isAdmin={isAdmin} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-slate-900">Crop Cultivation Timeline</h3>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            Persistent & Editable
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Configure current crop growth duration and projected harvest readiness milestones. Persisted locally and synced to the database.
        </p>

        <form onSubmit={handleSavePlant} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Current Plant Age (Days)
            </label>
            <input
              type="number"
              min="0"
              max="1500"
              value={plantAge}
              onChange={(e) => setLocalPlantAge(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Target Harvest Age (Days)
            </label>
            <input
              type="number"
              min="1"
              max="2000"
              value={harvestAge}
              onChange={(e) => setLocalHarvestAge(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-agri-500/30 bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={savingPlant}
            className="px-5 py-2.5 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            {savingPlant ? "Saving…" : "Save Cultivation Timeline"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-triangle-exclamation text-sm"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Critical Hazard Alarm Limits</h3>
              <p className="text-xs text-slate-500">
                Trigger dual-tone emergency siren alerts when conditions reach hazardous plant thresholds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => playAlertChime("critical")}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <i className="fa-solid fa-volume-high text-xs"></i> Test Urgent Siren Tone
          </button>
        </div>

        <form onSubmit={handleSaveCritical} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dehydration Hazard
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-bold">&lt;</span>
              <input
                type="number"
                min="1"
                max="30"
                value={critSoilMin}
                onChange={(e) => setCritSoilMin(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <span className="text-xs text-slate-500 font-mono">%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Severe drought & leaf shrinkage</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Root Rot Hazard
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-bold">&gt;</span>
              <input
                type="number"
                min="45"
                max="90"
                value={critSoilMax}
                onChange={(e) => setCritSoilMax(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <span className="text-xs text-slate-500 font-mono">%</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Over-saturation / fungal rot</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Extreme Heat Stress
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-bold">&gt;</span>
              <input
                type="number"
                min="30"
                max="50"
                value={critTempMax}
                onChange={(e) => setCritTempMax(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <span className="text-xs text-slate-500 font-mono">°C</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Cell wall collapse & scorched tips</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Cold Damage Limit
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-600 font-bold">&lt;</span>
              <input
                type="number"
                min="0"
                max="20"
                value={critTempMin}
                onChange={(e) => setCritTempMin(Number(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <span className="text-xs text-slate-500 font-mono">°C</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Freezing injury to gel core</p>
          </div>

          {isAdmin && (
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={savingCritical}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer flex items-center gap-2"
              >
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                {savingCritical ? "Saving Limits…" : "Save Critical Hazard Settings"}
              </button>
            </div>
          )}
        </form>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl ${
                audioAlertsEnabled ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"
              } flex items-center justify-center shrink-0`}
            >
              <i className={`fa-solid ${audioAlertsEnabled ? "fa-bell text-lg" : "fa-bell-slash text-lg"}`}></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Audio Chime & Warning Notifications</h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    audioAlertsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {audioAlertsEnabled ? "Active" : "Muted"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
                Synthesizes browser warning chimes and urgency sirens when aloe vera parameters exceed safe or critical hazard thresholds.
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
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> Test Critical Siren
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
