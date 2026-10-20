"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { calculateAloeVitality } from "@/lib/utils";

interface AloeVitalityCardProps {
  onOpenMatrix: () => void;
  onOpenReport: () => void;
}

export function AloeVitalityCard({ onOpenMatrix, onOpenReport }: AloeVitalityCardProps) {
  const { sensors } = useStore();

  const {
    score: compositeScore,
    status: statusLabel,
    moistureScore,
    tempScore,
    humidityScore,
    lightScore,
    isNight,
    isDusk,
  } = calculateAloeVitality(sensors);

  const soilMoisture = sensors.soilMoisture?.value ?? 25;
  const temperature = sensors.temperature?.value ?? 28;
  const humidity = sensors.humidity?.value ?? 55;
  const light = sensors.light?.value ?? 25000;

  const statusColor =
    compositeScore >= 85
      ? "text-emerald-700 bg-emerald-100/70 border-emerald-200"
      : compositeScore >= 65
      ? "text-amber-700 bg-amber-100/70 border-amber-200"
      : "text-rose-700 bg-rose-100/70 border-rose-200";

  const strokeColor =
    compositeScore >= 85
      ? "#10b981"
      : compositeScore >= 65
      ? "#f59e0b"
      : "#f43f5e";

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (compositeScore / 100) * circumference;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-card hover:shadow-md transition">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r={radius}
                className="text-slate-100 stroke-current"
                strokeWidth="10"
                fill="transparent"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke={strokeColor}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {compositeScore}%
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 mt-0.5">
                Vitality
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Aloe Vera Vitality Index</h3>
              <span className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                {statusLabel}
              </span>
              {isNight && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                  <i className="fa-solid fa-moon text-indigo-500"></i> Nighttime Mode (PST)
                </span>
              )}
              {isDusk && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                  <i className="fa-solid fa-cloud-sun text-amber-500"></i> Dusk / Sunset (PST)
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              {isNight
                ? "Real-time nighttime composite score for Aloe barbadensis Miller. Low lux penalty is excluded as stomata open for CAM CO2 absorption during darkness."
                : "Real-time physiological composite score for Aloe barbadensis Miller, dynamically weighted across root zone moisture, ambient thermal range, humidity, and CAM light exposure."}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700">
                <span className="text-slate-500 font-sans font-medium mr-1">Soil:</span>
                <strong className={moistureScore >= 80 ? "text-emerald-700" : "text-amber-700"}>{soilMoisture}%</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700">
                <span className="text-slate-500 font-sans font-medium mr-1">Temp:</span>
                <strong className={tempScore >= 80 ? "text-emerald-700" : "text-amber-700"}>{temperature}°C</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700">
                <span className="text-slate-500 font-sans font-medium mr-1">Humidity:</span>
                <strong className={humidityScore >= 80 ? "text-emerald-700" : "text-amber-700"}>{humidity}%</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700">
                <span className="text-slate-500 font-sans font-medium mr-1">Sunlight:</span>
                <strong className={isNight ? "text-indigo-600" : lightScore >= 80 ? "text-emerald-700" : "text-amber-700"}>
                  {light.toLocaleString()} lx {isNight ? "(Night Rest)" : isDusk ? "(Sunset)" : ""}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-row sm:flex-col gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={onOpenMatrix}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-agri-50 hover:bg-agri-100 text-agri-800 border border-agri-200/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <i className="fa-solid fa-book-bookmark text-agri-600"></i> Aloe Care Matrix
          </button>
          <button
            type="button"
            onClick={onOpenReport}
            className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <i className="fa-solid fa-file-invoice text-emerald-400"></i> Export Audit PDF
          </button>
        </div>
      </div>
    </div>
  );
}
