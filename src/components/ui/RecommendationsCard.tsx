"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { getStatus, formatNumber, getTimeOfDayPST } from "@/lib/utils";

import { supabase } from "@/lib/supabase";

export function RecommendationsCard() {
  const { sensors, setCurrentView, addActivity, updateSensor, recordWatering } = useStore();

  const persistRemedy = async (field: string, val: number) => {
    try {
      await supabase.from("sensor_readings").insert([{
        device_id: "agrisense-remedy",
        soil_moisture: field === "soilMoisture" ? val : sensors.soilMoisture.value,
        temperature: field === "temperature" ? val : sensors.temperature.value,
        humidity: field === "humidity" ? val : sensors.humidity.value,
        lux: field === "light" ? val : sensors.light.value,
      }]);
    } catch {}
  };

  const buildRecommendations = () => {
    const { isNight, isDusk } = getTimeOfDayPST();
    const recs: any[] = [];

    Object.values(sensors).forEach((s) => {
      // Adaptive light handling for night / dusk
      if (s.id === "light" && (isNight || isDusk)) {
        // Darkness is expected for Aloe CAM physiology at night.
        // Only warn if unnatural high light (>2000 lux) is disrupting nocturnal stomatal respiration.
        if (s.value > 2000) {
          recs.push({
            sensorId: s.id,
            text: "Excess light at night — may disrupt CAM respiration.",
            detail: "Aloe Vera stomata open during darkness to capture CO2. Turn off greenhouse lights.",
            icon: "fa-moon",
            action: { id: "btnLightsOff", label: "Turn off grow lights", icon: "fa-power-off" },
          });
        }
        return;
      }

      const status = getStatus(s);
      if (status === "ok") return;

      const isLow = status === "low";
      const map: Record<string, any> = {
        soilMoisture: isLow
          ? {
              title: isNight ? "Schedule morning watering" : "Water the plant now",
              detail: isNight
                ? `Soil moisture is low (${s.value}%). Irrigate in early morning to avoid nocturnal root fungal dampening.`
                : `Add ~1.5 L/m² before noon to reach ${s.optimal.min + 5}% moisture.`,
              icon: "fa-droplet",
              action: { id: "btnWaterNow", label: isNight ? "Irrigate morning cycle" : "Water plant now", icon: "fa-droplet" },
            }
          : {
              title: "Pause irrigation",
              detail: `Let moisture settle back toward ${s.optimal.max}%.`,
              icon: "fa-droplet-slash",
              action: { id: "btnPauseWater", label: "Pause irrigation cycle", icon: "fa-circle-check" },
            },
        temperature: isLow
          ? {
              title: "Warm the greenhouse",
              detail: `Aim for ${s.optimal.min}–${s.optimal.max}°C.`,
              icon: "fa-temperature-arrow-up",
              action: { id: "btnClimateUp", label: "Run heaters", icon: "fa-fire-flame-curved" },
            }
          : {
              title: "Cool the greenhouse",
              detail: `Reduce to ${s.optimal.min}–${s.optimal.max}°C.`,
              icon: "fa-temperature-arrow-down",
              action: { id: "btnClimateDown", label: "Open vents", icon: "fa-wind" },
            },
        humidity: isLow
          ? {
              title: "Boost humidity",
              detail: `Target: ${s.optimal.min}–${s.optimal.max}%.`,
              icon: "fa-cloud-rain",
              action: { id: "btnMistersOn", label: "Run misters", icon: "fa-spray-can" },
            }
          : {
              title: "Reduce humidity",
              detail: `Target: ${s.optimal.min}–${s.optimal.max}%. High nocturnal humidity risks fungal spot.`,
              icon: "fa-wind",
              action: { id: "btnMistersOff", label: "Ventilate", icon: "fa-wind" },
            },
        light: isLow
          ? {
              title: "Increase light",
              detail: `Optimal: ${formatNumber(s.optimal.min)}–${formatNumber(s.optimal.max)} lux.`,
              icon: "fa-lightbulb",
              action: { id: "btnLightsOn", label: "Turn on grow lights", icon: "fa-lightbulb" },
            }
          : {
              title: "Reduce light",
              detail: `Optimal: ${formatNumber(s.optimal.min)}–${formatNumber(s.optimal.max)} lux.`,
              icon: "fa-cloud",
              action: { id: "btnLightsOff", label: "Deploy shade cloth", icon: "fa-umbrella" },
            },
      };

      const r = map[s.id];
      if (r) {
        recs.push({
          sensorId: s.id,
          text: `${r.title} — ${s.label.toLowerCase()} ${isLow ? "below" : "above"} optimal range.`,
          detail: r.detail,
          icon: r.icon,
          action: r.action,
        });
      }
    });

    return recs;
  };

  const recs = buildRecommendations();

  const { isNight } = getTimeOfDayPST();

  if (recs.length === 0) {
    if (isNight) {
      return (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-indigo-900">Recommendations</p>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <i className="fa-solid fa-moon text-indigo-500"></i> Night Cycle (PST)
            </span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-moon text-indigo-600"></i>
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-950 leading-snug">
                Nocturnal Rest Cycle — stomata open for CAM CO₂ uptake.
              </p>
              <p className="text-xs text-indigo-700 mt-1">
                Zero/low lux is normal. Continuous monitoring of root moisture, thermal, and humidity active.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-agri-200 bg-agri-50 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-agri-800">Recommendations</p>
          <span className="text-[11px] font-medium text-agri-700 bg-agri-100 px-2 py-0.5 rounded-full">All clear</span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-agri-100 flex items-center justify-center flex-shrink-0">
            <i className="fa-solid fa-circle-check text-agri-600"></i>
          </div>
          <div>
            <p className="text-sm font-medium text-agri-900 leading-snug">
              Your crop is thriving — no action required right now.
            </p>
            <p className="text-xs text-agri-700 mt-1">We'll keep monitoring and alert you to changes.</p>
          </div>
        </div>
      </div>
    );
  }

  const top = recs[0];

  const handleAction = async () => {
    if (!top.action) return;
    if (top.action.id === "btnWaterNow") {
      await recordWatering();
      return;
    }
    if (top.action.id === "btnPauseWater") {
      const newMoist = Math.max(sensors.soilMoisture.optimal.min, sensors.soilMoisture.optimal.max - 2);
      updateSensor("soilMoisture", newMoist);
      addActivity("Irrigation paused — soil moisture returning to target range", "ok");
      await persistRemedy("soilMoisture", newMoist);
      return;
    }
    if (top.action.id === "btnClimateUp") {
      const target = Math.round((sensors.temperature.optimal.min + sensors.temperature.optimal.max) / 2);
      updateSensor("temperature", target);
      addActivity("Greenhouse climate heating engaged — temperature restored to optimal target", "ok");
      await persistRemedy("temperature", target);
      return;
    }
    if (top.action.id === "btnClimateDown") {
      const target = Math.round((sensors.temperature.optimal.min + sensors.temperature.optimal.max) / 2);
      updateSensor("temperature", target);
      addActivity("Greenhouse ventilation vents opened — cooling temperature back to optimal target", "ok");
      await persistRemedy("temperature", target);
      return;
    }
    if (top.action.id === "btnMistersOn") {
      const target = Math.round((sensors.humidity.optimal.min + sensors.humidity.optimal.max) / 2);
      updateSensor("humidity", target);
      addActivity("High-pressure misters activated — humidity restored to target level", "ok");
      await persistRemedy("humidity", target);
      return;
    }
    if (top.action.id === "btnMistersOff") {
      const target = Math.round((sensors.humidity.optimal.min + sensors.humidity.optimal.max) / 2);
      updateSensor("humidity", target);
      addActivity("Exhaust airflow enabled — humidity regulated down to optimal level", "ok");
      await persistRemedy("humidity", target);
      return;
    }
    if (top.action.id === "btnLightsOn") {
      const target = Math.round((sensors.light.optimal.min + sensors.light.optimal.max) / 2);
      updateSensor("light", target);
      addActivity("Supplemental grow lights activated — illumination restored", "ok");
      await persistRemedy("light", target);
      return;
    }
    if (top.action.id === "btnLightsOff") {
      const target = Math.round((sensors.light.optimal.min + sensors.light.optimal.max) / 2);
      updateSensor("light", target);
      addActivity("Automated shade screens deployed — light intensity normalized", "ok");
      await persistRemedy("light", target);
      return;
    }
    addActivity(`Executed action: ${top.action.label}`, "info");
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-amber-800">Recommendations</p>
          <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            {recs.length > 1 ? `${recs.length} actions` : "Action needed"}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <i className={`fa-solid ${top.icon} text-amber-600`}></i>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-900 leading-snug">{top.text}</p>
            <p className="text-xs text-amber-700 mt-1">{top.detail}</p>
          </div>
        </div>
      </div>

      <div>
        {top.action && (
          <button
            onClick={handleAction}
            className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <i className={`fa-solid ${top.action.icon} text-xs`}></i>
            <span>{top.action.label}</span>
          </button>
        )}
        {recs.length > 1 && (
          <p className="mt-3 text-[11px] text-amber-700">
            +{recs.length - 1} more recommendation{recs.length > 2 ? "s" : ""} — see{" "}
            <button onClick={() => setCurrentView("alerts")} className="underline font-medium hover:text-amber-900">
              Alerts
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}
