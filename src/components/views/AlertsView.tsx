"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { getStatus, formatNumber } from "@/lib/utils";

const TONE_CLASSES = {
  rose: {
    border: "border-rose-200",
    bg: "bg-rose-50",
    icon: "text-rose-500",
    badge: "bg-rose-100 text-rose-700",
  },
  amber: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    icon: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
  },
} as const;

export function AlertsView() {
  const { sensors, dismissedAlerts, dismissAlert, addActivity } = useStore();

  const liveAlerts = Object.values(sensors).reduce((acc: any[], s) => {
    const st = getStatus(s);
    if (st === "ok" || dismissedAlerts.has(s.id)) return acc;

    const severity = st === "high" && s.value > s.optimal.max * 1.25 ? "critical" : "warning";
    acc.push({
      sensorId: s.id,
      sensor: s.label,
      severity,
      message: `${s.label} is ${st === "low" ? "below" : "above"} optimal range — currently ${formatNumber(
        s.value,
        s.decimals
      )}${s.unit === "lux" ? " lux" : s.unit} (range ${s.optimal.min}–${s.optimal.max}).`,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
    return acc;
  }, []);

  const handleResolve = (sensorId: string, label: string) => {
    dismissAlert(sensorId);
    addActivity(`Alert for ${label} resolved`, "info");
  };

  const handleDismiss = (sensorId: string, label: string) => {
    dismissAlert(sensorId);
    addActivity(`Alert for ${label} dismissed`, "info");
  };

  const handleDismissAll = () => {
    liveAlerts.forEach((a) => dismissAlert(a.sensorId));
    addActivity("All alerts dismissed", "info");
  };

  if (liveAlerts.length === 0) {
    return (
      <section className="p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-agri-50 mx-auto flex items-center justify-center mb-4">
            <i className="fa-solid fa-circle-check text-agri-600 text-xl"></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No active alerts</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            All sensor readings are within optimal range. You're good to go!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Active alerts</h2>
          <p className="text-sm text-slate-500">
            {liveAlerts.length} {liveAlerts.length === 1 ? "condition needs" : "conditions need"} your attention.
          </p>
        </div>
        <button
          onClick={handleDismissAll}
          className="text-sm text-slate-500 hover:text-slate-700 font-medium transition"
        >
          Dismiss all
        </button>
      </div>

      <div className="space-y-3">
        {liveAlerts.map((a) => {
          const tone = a.severity === "critical" ? TONE_CLASSES.rose : TONE_CLASSES.amber;
          return (
            <div
              key={a.sensorId}
              className={`bg-white rounded-xl border ${tone.border} shadow-card p-5 flex items-start gap-4`}
            >
              <div
                className={`w-11 h-11 rounded-lg ${tone.bg} flex items-center justify-center flex-shrink-0`}
              >
                <i className={`fa-solid fa-triangle-exclamation ${tone.icon}`}></i>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{a.sensor}</p>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${tone.badge} px-2 py-0.5 rounded-full`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{a.message}</p>
                <p className="text-xs text-slate-400 mt-2">Detected at {a.time}</p>
              </div>
              <button
                onClick={() => handleResolve(a.sensorId, a.sensor)}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 transition"
              >
                <i className="fa-solid fa-check"></i> Mark as resolved
              </button>
              <button
                onClick={() => handleDismiss(a.sensorId, a.sensor)}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 ml-1 transition"
              >
                <i className="fa-solid fa-xmark"></i> Dismiss
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
