"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/lib/utils";
import { alertNotificationManager, AlertHistoryRecord } from "@/services/alertNotificationManager";

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
    emailAlertsEnabled,
    setEmailAlertsEnabled,
    moderatorEmail,
    setModeratorEmail,
    emailRecoveryEnabled,
    setEmailRecoveryEnabled,
    emailDisconnectEnabled,
    setEmailDisconnectEnabled,
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

  // Email Notification & Alert History State
  const [emailInput, setEmailInput] = useState(moderatorEmail || "");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "active" | "resolved">("all");

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

  useEffect(() => {
    setEmailInput(moderatorEmail || "");
  }, [moderatorEmail]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await alertNotificationManager.getAlertHistory();
      setAlertHistory(records);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

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
      showToast("Baseline thresholds restored", "ok");
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
      "ok"
    );
    showToast("Critical hazard limits saved", "ok");
    setTimeout(() => setSavingCritical(false), 400);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) {
      showToast("Please enter a valid email address", "warning");
      return;
    }
    setModeratorEmail(emailInput);
    addActivity(`Updated moderator alert email to ${emailInput}`, "ok");
    showToast(`Moderator email saved: ${emailInput}`, "ok");
  };

  const handleSendTestEmail = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      showToast("Please specify a valid email address first", "warning");
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await alertNotificationManager.dispatchEmail({
        type: "test",
        recipient: emailInput,
        hazardType: "Critical Low Soil Moisture (Drought Test)",
        currentReading: "8.5%",
        threshold: `< ${critSoilMin}%`,
        zone: "Aloe Vera Zone #1",
      });

      if (res.delivered) {
        showToast(`Test alert email sent to ${emailInput}!`, "ok");
        addActivity(`Dispatched test hazard email to ${emailInput}`, "ok");
      } else if (res.simulated) {
        showToast(res.message || "Test email was not delivered. SMTP is not configured.", "warning");
      } else {
        showToast(res.message || "Failed to dispatch test email", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to dispatch test email", "error");
    } finally {
      setSendingTestEmail(false);
      loadHistory();
    }
  };

  const filteredHistory = alertHistory.filter((item) => {
    if (historyFilter === "all") return true;
    return item.status === historyFilter;
  });

  return (
    <section className="p-8 space-y-6">
      {/* 1. Optimal Sensor Thresholds */}
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
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                <i className="fa-solid fa-rotate-left text-xs"></i>
                Restore Aloe Baseline
              </button>
            </div>
          )}
        </div>

        <div className="p-6 divide-y divide-slate-100">
          {Object.values(sensors).map((s) => (
            <ThresholdRow key={s.id} s={s} isAdmin={isAdmin} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>

      {/* 2. Critical Hazard Alarm Limits */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h3 className="text-base font-bold text-slate-900">Critical Hazard Alarm Limits</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Trigger emergency notifications and sirens when conditions breach hazardous biological thresholds.
            </p>
          </div>
          <button
            type="button"
            onClick={() => playAlertChime("critical")}
            className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <i className="fa-solid fa-volume-high text-xs"></i>
            Test Siren
          </button>
        </div>

        <form onSubmit={handleSaveCritical} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-droplet text-xs"></i> Dehydration Hazard
                </span>
                <span className="text-[10px] uppercase tracking-wider bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">
                  Min Moisture
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Aloe vera root desiccation trigger limit.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="1"
                  max="30"
                  disabled={!isAdmin}
                  value={critSoilMin}
                  onChange={(e) => setCritSoilMin(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-sm font-bold text-slate-800 font-mono disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-water text-xs"></i> Root Rot Hazard
                </span>
                <span className="text-[10px] uppercase tracking-wider bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded">
                  Max Moisture
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Substrate asphyxiation & fungal decay trigger limit.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="40"
                  max="100"
                  disabled={!isAdmin}
                  value={critSoilMax}
                  onChange={(e) => setCritSoilMax(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-rose-200 rounded-lg text-sm font-bold text-slate-800 font-mono disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                />
                <span className="text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-temperature-arrow-up text-xs"></i> Heat Spike Hazard
                </span>
                <span className="text-[10px] uppercase tracking-wider bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded">
                  Max Temp
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Parenchyma foliage burn & collapse trigger limit.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="32"
                  max="60"
                  disabled={!isAdmin}
                  value={critTempMax}
                  onChange={(e) => setCritTempMax(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-sm font-bold text-slate-800 font-mono disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <span className="text-xs font-bold text-slate-500">°C</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-sky-100 bg-sky-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-sky-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-snowflake text-xs"></i> Cold Stress Hazard
                </span>
                <span className="text-[10px] uppercase tracking-wider bg-sky-200 text-sky-800 px-1.5 py-0.5 rounded">
                  Min Temp
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Chilling injury and metabolic dormancy limit.</p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="0"
                  max="20"
                  disabled={!isAdmin}
                  value={critTempMin}
                  onChange={(e) => setCritTempMin(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-sky-200 rounded-lg text-sm font-bold text-slate-800 font-mono disabled:opacity-75 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                />
                <span className="text-xs font-bold text-slate-500">°C</span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingCritical}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                {savingCritical ? "Saving Limits…" : "Save Critical Hazard Settings"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 3. Automated Moderator Email Notifications (NEW) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-envelope-circle-check text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Automated Moderator Email Notifications</h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    emailAlertsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {emailAlertsEnabled ? "Active" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatches instant email alerts for hazardous conditions, plant stress, and sensor communication faults.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const next = !emailAlertsEnabled;
                setEmailAlertsEnabled(next);
                addActivity(`Email alerts ${next ? "enabled" : "disabled"}`, "info");
                showToast(`Email notifications ${next ? "activated" : "disabled"}`, "info");
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                emailAlertsEnabled
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700"
              }`}
            >
              <i className={`fa-solid ${emailAlertsEnabled ? "fa-toggle-on" : "fa-toggle-off"} text-sm`}></i>
              {emailAlertsEnabled ? "Disable Emails" : "Enable Emails"}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Moderator Email Configuration Form */}
          <form onSubmit={handleSaveEmail} className="flex flex-col sm:flex-row items-end gap-3 max-w-2xl">
            <div className="flex-1 w-full">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Your alert email
              </label>
              <div className="relative">
                <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="agrisense.alerts@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Hazard and recovery alerts are sent only to this address.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="submit"
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                Save Email
              </button>
              <button
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                title="Send a sample hazard notification to verify inbox delivery"
              >
                <i className={`fa-solid ${sendingTestEmail ? "fa-rotate animate-spin" : "fa-paper-plane"} text-xs`}></i>
                {sendingTestEmail ? "Sending…" : "Send Test Email"}
              </button>
            </div>
          </form>

          {/* SRE Alert Engine Policy Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {/* 1. Anti-Spam Status */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved text-sm text-emerald-600"></i> Anti-Spam Protection
                </span>
                <span className="text-[10px] uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-extrabold">
                  Always Active
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Dispatches exactly <strong>1 email</strong> when a hazard begins. Continuous 30-second readings while hazardous are suppressed to prevent email flooding.
              </p>
            </div>

            {/* 2. Recovery Notification */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check text-sm text-emerald-500"></i> Recovery Notifications
                </span>
                <input
                  type="checkbox"
                  checked={emailRecoveryEnabled}
                  onChange={(e) => {
                    setEmailRecoveryEnabled(e.target.checked);
                    showToast(`Recovery emails ${e.target.checked ? "enabled" : "muted"}`, "info");
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Sends an automated confirmation email when conditions safely return to the defined target range.
              </p>
            </div>

            {/* 3. Sensor Disconnection */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-plug-circle-xmark text-sm text-amber-500"></i> Disconnection Watchdog
                </span>
                <input
                  type="checkbox"
                  checked={emailDisconnectEnabled}
                  onChange={(e) => {
                    setEmailDisconnectEnabled(e.target.checked);
                    showToast(`Disconnection alerts ${e.target.checked ? "enabled" : "muted"}`, "info");
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Alerts moderator of hardware or Wi-Fi communication timeouts (&gt; 3 mins) rather than treating it as a false crop hazard.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Alert Lifecycle & Resolution History Table (NEW) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-clock-rotate-left text-base"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Alert Lifecycle & Resolution History</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                  {alertHistory.length} Logged
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of triggered hazards, actual sensor readings, resolution durations, and notification status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setHistoryFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("active")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyFilter === "active" ? "bg-white text-rose-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter("resolved")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  historyFilter === "resolved" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Resolved
              </button>
            </div>
            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition cursor-pointer"
              title="Refresh alert history"
            >
              <i className={`fa-solid fa-rotate ${loadingHistory ? "animate-spin" : ""} text-xs`}></i>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <i className="fa-solid fa-shield-heart text-2xl text-slate-300"></i>
              <p className="text-xs font-medium">No alerts recorded in this filter</p>
              <p className="text-[11px] text-slate-400">Hazard events and their resolution times will be tracked here automatically.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isActive = item.status === "active";
              const durationMin = item.duration_seconds ? Math.round(item.duration_seconds / 60) : null;

              return (
                <div key={item.id} className="p-4 hover:bg-slate-50/60 transition flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs mt-0.5 ${
                        isActive ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                      }`}
                    >
                      <i className={`fa-solid ${isActive ? "fa-triangle-exclamation" : "fa-circle-check"}`}></i>
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{item.hazard_type}</span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isActive ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.email_sent && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <i className="fa-solid fa-envelope text-[9px] text-indigo-500"></i>
                            {item.recipient}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">
                        Reading: <strong>{item.reading_value}</strong> · Threshold: <span className="font-mono text-slate-500">{item.threshold_limit}</span>
                      </p>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 pt-0.5">
                        <span>
                          <i className="fa-solid fa-clock mr-1 text-slate-300"></i>
                          Triggered: {new Date(item.triggered_at).toLocaleString()}
                        </span>
                        {item.resolved_at && (
                          <span className="text-emerald-700 font-medium">
                            <i className="fa-solid fa-check-double mr-1 text-emerald-500"></i>
                            Resolved in {durationMin && durationMin > 0 ? `${durationMin} mins` : `${item.duration_seconds || 1}s`} ({new Date(item.resolved_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Cultivation Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Crop Cultivation Timeline</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track growth cycle milestones and target maturity age.</p>
        </div>

        <form onSubmit={handleSavePlant} className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Current Plant Age (Days)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                disabled={!isAdmin}
                value={plantAge}
                onChange={(e) => setLocalPlantAge(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:opacity-75 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Target Harvest Age (Days)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                disabled={!isAdmin}
                value={harvestAge}
                onChange={(e) => setLocalHarvestAge(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:opacity-75 font-mono"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingPlant}
                className="px-5 py-2.5 bg-agri-600 hover:bg-agri-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <i className="fa-solid fa-floppy-disk text-xs"></i>
                {savingPlant ? "Saving…" : "Save Timeline Target"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 6. Audio Warning Chimes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
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
            <p className="text-xs text-slate-500 mt-0.5">
              Synthesizes browser warning chimes and urgency sirens when aloe vera parameters exceed safe or critical hazard thresholds.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => playAlertChime("info")}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-music text-xs"></i>
            Chime
          </button>
          <button
            type="button"
            onClick={() => playAlertChime("critical")}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <i className="fa-solid fa-triangle-exclamation text-xs"></i>
            Siren
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
