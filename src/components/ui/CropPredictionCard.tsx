"use client";

import React, { useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useWeather } from "@/hooks/useWeather";
import { predictCropOutcomes } from "@/services/cropPredictor";

export function CropPredictionCard() {
  const { sensors, farmLocation, farmSettings, manualWateringDays, recordWatering, setCurrentView } = useStore();
  const { weather, isLoading } = useWeather();

  const prediction = useMemo(() => {
    if (!weather) return null;
    return predictCropOutcomes(
      sensors.soilMoisture.value,
      sensors.temperature.value,
      sensors.humidity.value,
      sensors.light.value,
      weather,
      farmSettings,
      manualWateringDays
    );
  }, [sensors, weather, farmSettings, manualWateringDays]);

  if (isLoading || !weather || !prediction) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-6 bg-slate-200 rounded w-24"></div>
        </div>
        <div className="h-10 bg-slate-100 rounded-xl mb-3"></div>
        <div className="h-6 bg-slate-100 rounded w-2/3"></div>
      </div>
    );
  }

  const { overallStatus, currentDaysWithoutWater, seasonType, recommendedWateringIntervalDays, daysUntilWaterRequired, actionPlan } = prediction;
  const isUrgent = prediction.urgentActionRequired;
  const topAction = actionPlan[0];

  const badgeConfig = {
    optimal: { bg: "bg-emerald-50 border-emerald-200 text-emerald-700", dot: "bg-emerald-500", icon: "fa-circle-check" },
    monitor: { bg: "bg-sky-50 border-sky-200 text-sky-700", dot: "bg-sky-500", icon: "fa-clock" },
    mild_water_stress: { bg: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-500", icon: "fa-triangle-exclamation" },
    high_stress: { bg: "bg-orange-50 border-orange-200 text-orange-700", dot: "bg-orange-500", icon: "fa-circle-exclamation" },
    critical_drought: { bg: "bg-rose-50 border-rose-200 text-rose-700", dot: "bg-rose-500", icon: "fa-skull-crossbones" },
    overwatering: { bg: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-500", icon: "fa-droplet-slash" },
    heat_stress: { bg: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-500", icon: "fa-temperature-arrow-up" },
    cold_stress: { bg: "bg-cyan-50 border-cyan-200 text-cyan-700", dot: "bg-cyan-500", icon: "fa-snowflake" },
    sunburn: { bg: "bg-rose-50 border-rose-200 text-rose-700", dot: "bg-rose-500", icon: "fa-sun" },
  }[overallStatus.level] ?? { bg: "bg-slate-50 border-slate-200 text-slate-700", dot: "bg-slate-400", icon: "fa-info" };

  return (
    <div className="bg-gradient-to-br from-white to-slate-50/80 rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
            <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Crop Health & Weather Predictor</h3>
              <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <i className="fa-solid fa-location-dot text-[10px]"></i>
                {farmLocation.name}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Correlating 7-day weather forecast with soil moisture trends for Aloe Vera
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeConfig.bg}`}>
            <span className={`w-2 h-2 rounded-full ${badgeConfig.dot} animate-pulse`}></span>
            <i className={`fa-solid ${badgeConfig.icon} text-xs`}></i>
            {overallStatus.tagalogTitle}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-5">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Drought Tracker</span>
              <span className="text-xs font-medium text-slate-400 capitalize">
                {seasonType === "tag_init" ? "☀️ Tag-init (7–10 days)" : "🌧️ Tag-ulan (14–21 days)"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-slate-900">{currentDaysWithoutWater}</span>
              <span className="text-sm font-semibold text-slate-400">/ {recommendedWateringIntervalDays} days without water</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
              <div
                className={`h-full transition-all duration-500 ${
                  currentDaysWithoutWater >= 15
                    ? "bg-rose-500"
                    : currentDaysWithoutWater >= 10
                    ? "bg-amber-500"
                    : currentDaysWithoutWater >= 7
                    ? "bg-sky-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, (currentDaysWithoutWater / recommendedWateringIntervalDays) * 100)}%`,
                }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
              <span>Next target: <strong>{prediction.nextRecommendedWateringDate}</strong></span>
              <span className={daysUntilWaterRequired === 0 ? "text-rose-600 font-bold" : "text-slate-500"}>
                {daysUntilWaterRequired === 0 ? "DUE NOW" : `${daysUntilWaterRequired} day${daysUntilWaterRequired > 1 ? "s" : ""} left`}
              </span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Upcoming Weather</span>
              <span className="text-xs font-medium text-sky-600">7-Day Forecast</span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 text-xl font-bold">
                {weather.summary.totalRainExpectedMm > 0 ? "🌧️" : "☀️"}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {weather.summary.totalRainExpectedMm} mm total rain
                </p>
                <p className="text-xs text-slate-500">
                  {weather.summary.rainExpectedDays > 0
                    ? `Expected rain across ${weather.summary.rainExpectedDays} day(s)`
                    : "Dry spell: 0 mm rain expected in 7 days"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Peak Temp: <strong>{weather.summary.maxUpcomingTemp}°C</strong></span>
            {weather.summary.heatStressDays > 0 ? (
              <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                <i className="fa-solid fa-fire text-[10px]"></i>
                {weather.summary.heatStressDays}d ≥ 35°C
              </span>
            ) : (
              <span className="text-emerald-600 font-medium text-[11px]">Normal heat</span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold uppercase tracking-wider text-[10px]">End of Week Outlook</span>
              <span className="text-xs font-bold text-slate-700">
                Vitality: {overallStatus.vitalityEndOfWeek}%
              </span>
            </div>
            <div className="mt-2">
              <p className="text-sm font-bold text-slate-800 line-clamp-1">{overallStatus.title}</p>
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                {overallStatus.tagalogDescription}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Leaf condition:</span>
            <span className="font-medium text-slate-700">{prediction.leafSymptoms.thickness} • {prediction.leafSymptoms.texture}</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
            <i className="fa-solid fa-lightbulb"></i>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Agronomist Recommendation</p>
            <p className="text-sm font-medium text-slate-100 mt-0.5">
              {topAction ? topAction.tagalogAction : "Ipagpatuloy ang regular na pag-monitor."}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {topAction ? topAction.tagalogReason : "Nasa maayos na balanse ang lupa at pananim."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => recordWatering()}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <i className="fa-solid fa-droplet text-xs"></i>
            Watered Today
          </button>
          <button
            onClick={() => setCurrentView("predictions")}
            className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
          >
            Full 7-Day Simulation
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
