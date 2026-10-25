"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { getStatus, formatNumber, getTimeOfDayPST, showToast } from "@/lib/utils";

export function RecommendationsCard() {
  const { sensors, setCurrentView, addActivity } = useStore();
  const [acknowledgedSensors, setAcknowledgedSensors] = useState<Set<string>>(new Set());

  const buildRecommendations = () => {
    const { isNight, isDusk } = getTimeOfDayPST();
    const recs: any[] = [];

    Object.values(sensors).forEach((s) => {
      if (acknowledgedSensors.has(s.id)) return;

      const status = getStatus(s);
      if (status === "ok") return;

      if (status === "disconnected") {
        recs.push({
          sensorId: s.id,
          text: `Sensor Offline — ${s.label} disconnected.`,
          detail: `No valid signal received from ${s.label}. Check physical wiring on ESP32 breadboard pins.`,
          icon: "fa-plug-circle-xmark",
        });
        return;
      }

      // Adaptive light handling for night / dusk
      if (s.id === "light" && (isNight || isDusk)) {
        if (s.value !== null && s.value > 2000) {
          recs.push({
            sensorId: s.id,
            text: "Excess light detected during nocturnal rest period.",
            detail: "Aloe Vera CAM stomata open in darkness for CO2 uptake. Turn off any artificial greenhouse lighting.",
            icon: "fa-moon",
          });
        }
        return;
      }

      const isLow = status === "low";
      const map: Record<string, any> = {
        soilMoisture: isLow
          ? {
              title: isNight ? "Schedule morning manual watering" : "Manually water your aloe vera",
              detail: isNight
                ? `Soil moisture is low (${s.value}%). Manually apply water in the early morning (~8 AM) to avoid nocturnal root dampness.`
                : `Soil moisture is low (${s.value}%). Manually apply ~1.5 L/m² at the base before noon to restore safe root moisture.`,
              icon: "fa-droplet",
            }
          : {
              title: "Withhold manual watering",
              detail: `Soil moisture is high (${s.value}%). Allow potting substrate to dry out toward ${s.optimal.max}% to avoid root rot risk.`,
              icon: "fa-droplet-slash",
            },
        temperature: isLow
          ? {
              title: "Provide manual thermal shelter",
              detail: `Temperature is low (${s.value}°C). Manually close greenhouse flaps or move potted aloe to a warmer microclimate (${s.optimal.min}–${s.optimal.max}°C).`,
              icon: "fa-temperature-arrow-up",
            }
          : {
              title: "Increase natural ventilation manually",
              detail: `Temperature is elevated (${s.value}°C). Manually open greenhouse door flaps or position shade cloth to bring temperature down to ${s.optimal.max}°C.`,
              icon: "fa-temperature-arrow-down",
            },
        humidity: isLow
          ? {
              title: "Lightly mist surrounding soil",
              detail: `Relative humidity is low (${s.value}%). Manually dampen the ground or perimeter walkways to reach ${s.optimal.min}–${s.optimal.max}%.`,
              icon: "fa-cloud-rain",
            }
          : {
              title: "Improve manual cross-ventilation",
              detail: `High humidity (${s.value}%) risks fungal leaf spotting. Promote natural cross-draft air circulation around aloe plants.`,
              icon: "fa-wind",
            },
        light: isLow
          ? {
              title: "Relocate plants for sunlight",
              detail: `Daylight is low (${s.value !== null ? formatNumber(s.value) : "—"} lux). Manually move potted aloe away from dense shade (target: ${formatNumber(s.optimal.min)}–${formatNumber(s.optimal.max)} lux).`,
              icon: "fa-lightbulb",
            }
          : {
              title: "Deploy 30–50% shade netting manually",
              detail: `Sunlight is intense (${s.value !== null ? formatNumber(s.value) : "—"} lux). Manually unroll overhead shade netting to protect foliage from sunburn.`,
              icon: "fa-cloud-sun",
            },
      };

      const r = map[s.id];
      if (r) {
        recs.push({
          sensorId: s.id,
          text: `${r.title} (${s.label.toLowerCase()} ${isLow ? "below" : "above"} optimal).`,
          detail: r.detail,
          icon: r.icon,
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
                Zero/low lux is natural and expected. Continuous monitoring of moisture, thermal, and humidity active.
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
            <p className="text-xs text-agri-700 mt-1">Telemetry will continuously monitor microclimate and alert you to any shifts.</p>
          </div>
        </div>
      </div>
    );
  }

  const top = recs[0];

  const handleAcknowledge = async () => {
    if (!top) return;
    setAcknowledgedSensors((prev) => new Set(prev).add(top.sensorId));
    await addActivity(`Acknowledged recommendation: ${top.text}`, "info");
    showToast("Recommendation acknowledged", "ok");
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-amber-800">Agronomist Advisory</p>
          <span className="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            {recs.length > 1 ? `${recs.length} advisories` : "Advisory"}
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
        <button
          onClick={handleAcknowledge}
          className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer shadow-xs active:scale-98"
        >
          <i className="fa-solid fa-check text-xs"></i>
          <span>Acknowledge recommendation</span>
        </button>

        {recs.length > 1 && (
          <p className="mt-3 text-[11px] text-amber-700">
            +{recs.length - 1} more advisory — see{" "}
            <button onClick={() => setCurrentView("alerts")} className="underline font-semibold hover:text-amber-900 cursor-pointer">
              Alerts
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}
