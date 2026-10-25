"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { getStatus, clamp, getTimeOfDayPST, calculateAloeVitality } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export function PlantStatusCard() {
  const { sensors, telemetrySource } = useStore();
  const { isNight } = getTimeOfDayPST();
  const disconnected = Object.values(sensors).filter((s) => getStatus(s) === "disconnected");
  const out = Object.values(sensors).filter((s) => getStatus(s) !== "ok" && getStatus(s) !== "disconnected");

  const { score: currentLiveVitality } = calculateAloeVitality(sensors);
  const [overallVitality, setOverallVitality] = useState<number | null>(null);
  const [readingsCount, setReadingsCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function computeOverallVitality() {
      try {
        const { data, error } = await supabase
          .from("sensor_readings")
          .select("soil_moisture, temperature, humidity, lux, recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(30);

        if (!error && data && data.length > 0 && isMounted) {
          const validScores = data
            .map((r: any) => {
              const rowSensors: Record<string, any> = {
                soilMoisture: { id: "soilMoisture", value: r.soil_moisture, optimal: sensors.soilMoisture?.optimal || { min: 18, max: 32 } },
                temperature: { id: "temperature", value: r.temperature, optimal: sensors.temperature?.optimal || { min: 24, max: 32 } },
                humidity: { id: "humidity", value: r.humidity, optimal: sensors.humidity?.optimal || { min: 45, max: 65 } },
                light: { id: "light", value: r.lux, unit: "lux", optimal: sensors.light?.optimal || { min: 20000, max: 42000 } },
              };
              const date = r.recorded_at ? new Date(r.recorded_at) : new Date();
              return calculateAloeVitality(rowSensors, date).score;
            })
            .filter((s: number) => !isNaN(s));

          if (validScores.length > 0) {
            const avg = Math.round(validScores.reduce((acc, val) => acc + val, 0) / validScores.length);
            setOverallVitality(avg);
            setReadingsCount(validScores.length);
            return;
          }
        }
        if (isMounted) {
          setOverallVitality(currentLiveVitality);
        }
      } catch {
        if (isMounted) setOverallVitality(currentLiveVitality);
      }
    }

    computeOverallVitality();

    const channel = supabase
      .channel("plant_status_vitality_sync")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        () => {
          computeOverallVitality();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentLiveVitality, sensors]);

  const displayVitality = overallVitality ?? currentLiveVitality;

  let label, reason, iconColor, iconBg, icon, stress, stressColor;

  if (disconnected.length > 0) {
    label = "Sensor Disconnected";
    reason = `${disconnected.map((s) => s.label).join(", ")}: no signal received`;
    iconColor = "text-rose-700";
    iconBg = "bg-rose-100";
    icon = "fa-plug-circle-xmark";
    stress = "Disconnected";
    stressColor = "text-rose-600";
  } else if (out.length === 0 && displayVitality >= 80) {
    label = "Healthy";
    reason = isNight ? "Nighttime resting state — CAM active" : "Optimal historical & live microclimate";
    iconColor = isNight ? "text-indigo-600" : "text-agri-700";
    iconBg = isNight ? "bg-indigo-50" : "bg-agri-100";
    icon = isNight ? "fa-moon" : "fa-heart";
    stress = "Low";
    stressColor = isNight ? "text-indigo-600" : "text-agri-600";
  } else if (out.length === 1) {
    label = "Warning";
    reason = `${out[0].label} (${out[0].value !== null ? out[0].value : '—'}${out[0].unit === 'lux' ? ' lx' : out[0].unit}) out of range`;
    iconColor = "text-amber-700";
    iconBg = "bg-amber-100";
    icon = "fa-triangle-exclamation";
    stress = "Medium";
    stressColor = "text-amber-600";
  } else {
    label = "Critical";
    reason = out.length > 1
      ? `${out.map((s) => `${s.label} (${s.value ?? '—'}${s.unit === 'lux' ? ' lx' : s.unit})`).join(", ")} out of range`
      : `Cumulative vitality at ${displayVitality}%`;
    iconColor = "text-rose-700";
    iconBg = "bg-rose-100";
    icon = "fa-circle-exclamation";
    stress = "High";
    stressColor = "text-rose-600";
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">Plant Status</p>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            telemetrySource === "hardware"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          {telemetrySource === "hardware" ? "Live ESP32" : "Baseline"}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
          <i className={`fa-solid ${icon} ${iconColor} text-lg`}></i>
        </div>
        <div>
          <p className={`text-lg font-semibold ${iconColor}`}>
            {label}
          </p>
          <p className="text-xs text-slate-500 leading-snug">{reason}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Overall Vitality</p>
          <p className="text-sm font-bold text-slate-800" title="Overall vitality average base sa mga nakaraang telemetry readings">
            {displayVitality}%
          </p>
          <span className="text-[9px] text-slate-400 block -mt-0.5" title="Average mula sa mga nakaraang readings sa database">
            {readingsCount > 0 ? `Past ${readingsCount} logs` : "Live telemetry"}
          </span>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Stress</p>
          <p className={`text-sm font-semibold ${stressColor}`}>{stress}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Growth</p>
          <p className="text-sm font-semibold text-slate-700">{out.length > 1 || displayVitality < 65 ? "Slowed" : "Stable"}</p>
        </div>
      </div>
    </div>
  );
}

