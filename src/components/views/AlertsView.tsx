"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { getStatus, formatNumber, getTimeOfDayPST, showToast } from "@/lib/utils";

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
  const { isNight } = getTimeOfDayPST();

  const liveAlerts = Object.values(sensors).reduce((acc: any[], s) => {
    const st = getStatus(s);
    if (st === "ok" || dismissedAlerts.has(s.id)) return acc;

    if (st === "disconnected") {
      acc.push({
        sensorId: s.id,
        sensor: s.label,
        severity: "critical",
        isDisconnected: true,
        message: `${s.label} sensor is offline / disconnected — ESP32 received no valid telemetry payload.`,
        recommendation: `Check physical jumper cables to ${s.label} on the ESP32 breadboard (3.3V, GND, and GPIO signal pin). Verify node Wi-Fi connection.`,
        time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
      return acc;
    }

    const isLow = st === "low";
    let recommendation = "";
    if (s.id === "soilMoisture") {
      recommendation = isLow
        ? isNight
          ? "Moisture is depleted. Schedule manual watering of ~1.5 L/m² for the early morning (~8:00 AM) to prevent overnight fungal dampening."
          : "Moisture is low. Water aloe vera at the root perimeter (~1.5 L/m²) before peak midday sun to restore safe hydration."
        : "Moisture is excessive. Withhold watering and let the potting substrate dry thoroughly to avoid root rot.";
    } else if (s.id === "temperature") {
      recommendation = isLow
        ? "Ambient temperature is low. Move potted aloe to a warmer microclimate or close greenhouse windbreaks."
        : "High temperature detected. Ensure adequate cross-ventilation and deploy overhead shade netting during midday.";
    } else if (s.id === "humidity") {
      recommendation = isLow
        ? "Low ambient humidity. Lightly dampen surrounding soil or walkway floor to boost microclimate moisture."
        : "Elevated humidity increases fungal leaf spot risk. Promote natural cross-draft airflow around the crop.";
    } else if (s.id === "light") {
      recommendation = isLow
        ? "Sub-optimal daylight illumination. Relocate plants into an area with unobstructed natural sunlight."
        : "Excessive solar irradiance. Deploy 30–50% shade netting overhead to prevent leaf reddening and sunburn.";
    }

    const severity = (st === "high" && s.value !== null && s.value > s.optimal.max * 1.25) || (st === "low" && s.value !== null && s.value < s.optimal.min * 0.75)
      ? "critical"
      : "warning";

    acc.push({
      sensorId: s.id,
      sensor: s.label,
      severity,
      isDisconnected: false,
      message: `${s.label} is ${isLow ? "below" : "above"} optimal range — currently ${s.value !== null ? formatNumber(s.value, s.decimals) : "—"}${s.unit === "lux" ? " lux" : s.unit} (optimal ${s.optimal.min}–${s.optimal.max}).`,
      recommendation,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    });
    return acc;
  }, []);

  const handleAcknowledge = async (sensorId: string, label: string) => {
    dismissAlert(sensorId);
    await addActivity(`Acknowledged alert & recommendation for ${label}`, "info");
    showToast(`Alert acknowledged for ${label}`, "ok");
  };

  const handleDismiss = (sensorId: string, label: string) => {
    dismissAlert(sensorId);
    addActivity(`Dismissed alert for ${label}`, "info");
  };

  const handleDismissAll = () => {
    liveAlerts.forEach((a) => dismissAlert(a.sensorId));
    addActivity("All active alerts acknowledged & dismissed", "info");
    showToast("All alerts dismissed", "info");
  };

  if (liveAlerts.length === 0) {
    return (
      <section className="p-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-agri-50 mx-auto flex items-center justify-center mb-4">
            <i className={`fa-solid ${isNight ? "fa-moon text-indigo-600" : "fa-circle-check text-agri-600"} text-xl`}></i>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {isNight ? "Nighttime Resting Mode — No Active Alerts" : "No active alerts"}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            {isNight
              ? "Darkness is expected for nocturnal CAM respiration in the Philippines. Soil moisture, temperature, and humidity remain continuously safeguarded."
              : "All sensor readings and hardware nodes are operating within optimal range. You're good to go!"}
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
          className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
        >
          Dismiss all
        </button>
      </div>

      <div className="space-y-4">
        {liveAlerts.map((a) => {
          const tone = a.severity === "critical" ? TONE_CLASSES.rose : TONE_CLASSES.amber;
          return (
            <div
              key={a.sensorId}
              className={`bg-white rounded-xl border ${tone.border} shadow-card p-5 flex flex-col md:flex-row md:items-start justify-between gap-4`}
            >
              <div className="flex items-start gap-4 flex-1">
                <div
                  className={`w-11 h-11 rounded-xl ${tone.bg} flex items-center justify-center shrink-0`}
                >
                  <i className={`fa-solid ${a.isDisconnected ? "fa-plug-circle-xmark" : "fa-triangle-exclamation"} ${tone.icon} text-lg`}></i>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900">{a.sensor}</p>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${tone.badge} px-2 py-0.5 rounded-full`}
                    >
                      {a.severity}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto">Detected at {a.time}</span>
                  </div>

                  <p className="text-sm text-slate-700">{a.message}</p>

                  {a.recommendation && (
                    <div className="p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-950">
                      <i className="fa-solid fa-lightbulb text-emerald-600 mt-0.5 shrink-0 text-sm"></i>
                      <div>
                        <strong className="block text-[11px] font-bold uppercase tracking-wide text-emerald-800">
                          Recommended Action
                        </strong>
                        <p className="mt-0.5 text-emerald-900 leading-relaxed">{a.recommendation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex md:flex-col items-center justify-end gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <button
                  onClick={() => handleAcknowledge(a.sensorId, a.sensor)}
                  className="flex-1 md:flex-initial text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold px-3 py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-check text-xs"></i> Acknowledge recommendation
                </button>
                <button
                  onClick={() => handleDismiss(a.sensorId, a.sensor)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
