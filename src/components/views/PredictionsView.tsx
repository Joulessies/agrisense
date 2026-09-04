"use client";

import React, { useState, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { useWeather } from "@/hooks/useWeather";
import { PHILIPPINES_FARM_LOCATIONS } from "@/services/weather";
import { predictCropOutcomes, DailyPrediction } from "@/services/cropPredictor";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function PredictionsView() {
  const {
    sensors,
    farmLocation,
    farmSettings,
    setFarmSettings,
    manualWateringDays,
    setManualWateringDays,
    recordWatering,
    addActivity,
  } = useStore();

  const { weather, isLoading: weatherLoading, setLocation, refresh } = useWeather();

  const [searchCity, setSearchCity] = useState("");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<any | null>(null);
  const [aiLanguage, setAiLanguage] = useState<"tl" | "en">("tl");

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

  const selectedDay: DailyPrediction | null = useMemo(() => {
    if (!prediction || !prediction.dailyForecastTimeline[selectedDayIdx]) return null;
    return prediction.dailyForecastTimeline[selectedDayIdx];
  }, [prediction, selectedDayIdx]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCity.trim()) return;
    const res = await refresh(searchCity.trim());
    if (res && res.location) {
      addActivity(`Updated weather forecast location to ${res.location.name}`, "info");
    }
    setSearchCity("");
  };

  const handleGpsLocation = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const res = await refresh({
            name: "Current GPS Location",
            country: "PH",
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          if (res) addActivity("Set weather location from device GPS", "info");
        },
        (err) => {
          alert(`GPS lookup failed: ${err.message}`);
        }
      );
    }
  };

  const handleGenerateAiPrognosis = async () => {
    if (!weather || !prediction) return;
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/crop-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: farmLocation,
          currentSensors: {
            soilMoisture: sensors.soilMoisture.value,
            temperature: sensors.temperature.value,
            humidity: sensors.humidity.value,
            light: sensors.light.value,
          },
          weatherSummary: weather.summary,
          forecastDays: weather.forecast,
          farmSettings,
          daysWithoutWater: prediction.currentDaysWithoutWater,
          calculatedStress: prediction.overallStatus.title,
        }),
      });

      if (!res.ok) throw new Error("API call failed");
      const data = await res.json();
      if (data.aiAnalysis) {
        setAiReport(data.aiAnalysis);
        addActivity("Generated AI crop outcome report", "info");
      }
    } catch (err: any) {
      alert(`Could not generate AI report: ${err.message}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!prediction) return null;
    const labels = prediction.dailyForecastTimeline.map((d, idx) => {
      const dt = new Date(d.date + "T12:00:00");
      return idx === 0 ? "Today" : dt.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
    });

    return {
      labels,
      datasets: [
        {
          label: "Simulated Soil Moisture (%)",
          data: prediction.dailyForecastTimeline.map((d) => d.simulatedSoilMoisture),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          fill: true,
          tension: 0.35,
          yAxisID: "yMoisture",
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
        },
        {
          label: "Forecast Max Temp (°C)",
          data: prediction.dailyForecastTimeline.map((d) => d.simulatedTempMax),
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          borderDash: [5, 4],
          tension: 0.25,
          yAxisID: "yTemp",
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: "#f59e0b",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
        },
        {
          label: "Expected Rain (mm)",
          data: prediction.dailyForecastTimeline.map((d) => d.weather.rainMm),
          borderColor: "#0284c7",
          backgroundColor: "rgba(14, 165, 233, 0.55)",
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          type: "bar" as any,
          yAxisID: "yRain",
          barPercentage: 0.45,
        },
      ],
    };
  }, [prediction]);

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        titleFont: { size: 12, weight: "bold" },
        bodyFont: { size: 11 },
        padding: 12,
        cornerRadius: 10,
        boxPadding: 4,
        callbacks: {
          afterBody: (items: any[]) => {
            const idx = items[0]?.dataIndex;
            if (idx != null && prediction?.dailyForecastTimeline[idx]) {
              const d = prediction.dailyForecastTimeline[idx];
              return [
                `Days unwatered: ${d.daysWithoutWater}d`,
                `Status: ${d.primaryCondition}`,
                `Precipitation chance: ${Math.round(d.weather.pop * 100)}%`,
              ];
            }
            return [];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11, weight: "500" }, color: "#64748b" },
      },
      yMoisture: {
        type: "linear",
        position: "left",
        min: 0,
        max: 80,
        title: { display: true, text: "Soil Moisture (%)", font: { size: 11, weight: "600" }, color: "#059669" },
        grid: { color: "#f1f5f9" },
        ticks: { color: "#64748b", font: { size: 10 } },
      },
      yTemp: {
        type: "linear",
        position: "right",
        min: 15,
        max: 42,
        title: { display: true, text: "Temp (°C)", font: { size: 11, weight: "600" }, color: "#d97706" },
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 10 } },
      },
      yRain: {
        display: false,
        min: 0,
        max: 40,
      },
    },
  };

  return (
    <section className="p-8 space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold shadow-sm">
              <i className="fa-solid fa-chart-line text-sm"></i>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Crop Health & Weather Predictor</h2>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Aloe Vera Barbadensis
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Correlates 7-day high-resolution meteorological forecasts with multi-day sensor telemetry to project soil moisture trajectories, leaf symptoms, and stress levels.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <form onSubmit={handleCitySearch} className="flex items-center gap-1.5">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass text-xs text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
              <input
                type="text"
                placeholder="Search PH municipality/city..."
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 w-48 sm:w-56"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
            >
              Search
            </button>
          </form>

          <button
            onClick={handleGpsLocation}
            title="Use current device GPS location"
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5 text-xs font-medium"
          >
            <i className="fa-solid fa-location-crosshairs text-xs text-emerald-600"></i>
            <span className="hidden sm:inline">GPS</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0 mr-1 flex items-center gap-1">
          <i className="fa-solid fa-map-pin text-[10px] text-emerald-600"></i>
          PH Regions:
        </span>
        {PHILIPPINES_FARM_LOCATIONS.map((loc) => {
          const isActive = farmLocation.name.toLowerCase() === loc.name.toLowerCase();
          return (
            <button
              key={loc.name}
              onClick={() => setLocation(loc)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition shrink-0 flex items-center gap-1.5 border ${
                isActive
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm font-semibold"
                  : "bg-white text-slate-600 hover:bg-slate-50 border-slate-200"
              }`}
            >
              <i className={`fa-solid fa-location-dot text-[10px] ${isActive ? "text-white" : "text-slate-400"}`}></i>
              {loc.name}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-emerald-600"></i>
              Crop & Environment Parameters
            </h3>
            <p className="text-xs text-slate-500">
              Customize pot volume, sunlight levels, and days since last irrigation to match your physical greenhouse or field.
            </p>
          </div>

          <button
            onClick={() => recordWatering()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm self-start sm:self-auto"
          >
            <i className="fa-solid fa-droplet text-xs"></i>
            Watered Today (Reset to Day 0)
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700">Days Since Last Water</label>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {prediction?.currentDaysWithoutWater ?? 0} days
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              value={prediction?.currentDaysWithoutWater ?? 0}
              onChange={(e) => setManualWateringDays(parseInt(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer my-1"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>0 (Hydrated)</span>
              <span>10d (Delayed)</span>
              <span>21d+ (Drought)</span>
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <label className="text-xs font-semibold text-slate-700 block mb-2">Container / Pot Size</label>
            <select
              value={farmSettings.potSize}
              onChange={(e) => setFarmSettings({ potSize: e.target.value as any })}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="small">Small Pot (Dries ~1.4x faster)</option>
              <option value="medium">Medium Pot / Polybag</option>
              <option value="large_ground">Large Container / In-Ground</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1.5 block">Alters soil evaporation gradient</span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <label className="text-xs font-semibold text-slate-700 block mb-2">Sunlight Exposure</label>
            <select
              value={farmSettings.sunExposure}
              onChange={(e) => setFarmSettings({ sunExposure: e.target.value as any })}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="full">Full Direct Sun (Harsh Midday)</option>
              <option value="partial">Morning Sun + Midday Shade (Optimal)</option>
              <option value="shaded">Greenhouse 50% Shade Net</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1.5 block">Affects transpiration & sunburn risk</span>
          </div>

          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80">
            <label className="text-xs font-semibold text-slate-700 block mb-2">Soil Drainage Substrate</label>
            <select
              value={farmSettings.soilType}
              onChange={(e) => setFarmSettings({ soilType: e.target.value as any })}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="fast_draining">Fast Draining (Pumice/Sand/Perlite)</option>
              <option value="standard">Standard Garden Loam</option>
              <option value="clay">Dense Clay (High Water Retention)</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-1.5 block">Controls water holding capacity</span>
          </div>
        </div>
      </div>

      {prediction && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <i className="fa-solid fa-calendar-days text-emerald-600"></i>
              7-Day Microclimate & Plant State Timeline
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Click any day to inspect predicted leaf symptoms
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {prediction.dailyForecastTimeline.map((d, idx) => {
              const isSelected = selectedDayIdx === idx;
              const dateObj = new Date(d.date + "T12:00:00");
              const dayName = idx === 0 ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "short" });
              const dateFormatted = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

              const badgeColors = {
                optimal: "bg-emerald-100 text-emerald-800 border-emerald-200",
                monitor: "bg-sky-100 text-sky-800 border-sky-200",
                mild_water_stress: "bg-amber-100 text-amber-800 border-amber-200",
                high_stress: "bg-orange-100 text-orange-800 border-orange-200",
                critical_drought: "bg-rose-100 text-rose-800 border-rose-200",
                overwatering: "bg-purple-100 text-purple-800 border-purple-200",
                heat_stress: "bg-amber-100 text-amber-800 border-amber-200",
                cold_stress: "bg-cyan-100 text-cyan-800 border-cyan-200",
                sunburn: "bg-rose-100 text-rose-800 border-rose-200",
              }[d.stressLevel] || "bg-slate-100 text-slate-700 border-slate-200";

              return (
                <button
                  key={d.date}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`rounded-2xl p-4 text-left border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                    isSelected
                      ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20 -translate-y-0.5"
                      : "bg-white/90 hover:bg-white border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-xs text-slate-900">{dayName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{dateFormatted}</span>
                    </div>

                    <div className="flex items-center gap-2 my-2.5">
                      <span className="text-2xl">
                        {d.weather.rainMm >= 2 ? "🌧️" : d.simulatedTempMax >= 33 ? "☀️" : "⛅"}
                      </span>
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          {d.simulatedTempMax}° <span className="text-[10px] text-slate-400 font-normal">/ {d.simulatedTempMin}°</span>
                        </p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[85px]">
                          {d.weather.rainMm > 0 ? `${d.weather.rainMm}mm rain` : d.weather.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Moisture:</span>
                      <strong className={d.simulatedSoilMoisture < 15 ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"}>
                        {d.simulatedSoilMoisture}%
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Unwatered:</span>
                      <strong className="text-slate-700 font-semibold">{d.daysWithoutWater}d</strong>
                    </div>

                    <span className={`block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-center truncate border mt-1 ${badgeColors}`}>
                      {d.stressLevel.replace("_", " ")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {chartData && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-chart-area text-emerald-600"></i>
                Simulated 7-Day Moisture & Temperature Curves
              </h3>
              <p className="text-xs text-slate-500">
                Evapotranspiration simulation showing moisture depletion rate and rainfall replenishment.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Soil Moisture (%)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Max Temp (°C)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-500"></span>
                <span>Rainfall (mm)</span>
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-1">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {selectedDay && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Day Inspection Breakdown
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Day {selectedDay.dayIndex + 1} — {new Date(selectedDay.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400 block">Projected Vitality</span>
                <span className="text-2xl font-black text-emerald-600">{selectedDay.vitalityScore}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50/80 rounded-xl p-3.5 text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Soil Moisture</p>
                <p className="text-lg font-black text-slate-800 mt-0.5">{selectedDay.simulatedSoilMoisture}%</p>
              </div>
              <div className="bg-slate-50/80 rounded-xl p-3.5 text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Drought Days</p>
                <p className="text-lg font-black text-slate-800 mt-0.5">{selectedDay.daysWithoutWater}d</p>
              </div>
              <div className="bg-slate-50/80 rounded-xl p-3.5 text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Day High Temp</p>
                <p className="text-lg font-black text-amber-600 mt-0.5">{selectedDay.simulatedTempMax}°C</p>
              </div>
              <div className="bg-slate-50/80 rounded-xl p-3.5 text-center border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Rain Volume</p>
                <p className="text-lg font-black text-sky-600 mt-0.5">{selectedDay.weather.rainMm} mm</p>
              </div>
            </div>

            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation text-amber-600 text-sm"></i>
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Predicted State: {selectedDay.primaryCondition}
                </h4>
              </div>
              {selectedDay.alerts.map((alert, aIdx) => (
                <p key={aIdx} className="text-xs text-amber-800 leading-relaxed pl-5">
                  • {alert}
                </p>
              ))}
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <i className="fa-solid fa-leaf text-emerald-600 text-xs"></i>
                Physical Leaf Characteristics & Symptom Diagnosis
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Thickness</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedDay.leafSymptom.thickness}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Texture</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedDay.leafSymptom.texture}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Coloring</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedDay.leafSymptom.color}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Posture</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedDay.leafSymptom.posture}</span>
                </div>
                <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/60 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Root Health & Substrate State</span>
                  <span className="font-bold text-slate-800 text-xs mt-0.5 block">{selectedDay.leafSymptom.roots}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <i className="fa-solid fa-clipboard-check text-sm"></i>
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-white">Recommended Actions</h4>
                    <p className="text-[10px] text-slate-400">Rules-based irrigation protocol</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 border border-white/10">
                  {prediction?.daysUntilWaterRequired === 0 ? "Due Today" : `In ${prediction?.daysUntilWaterRequired}d`}
                </span>
              </div>

              <div className="bg-white/5 rounded-xl p-3.5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Irrigation Interval</span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {prediction?.seasonType === "tag_init" ? "Tag-init (7–10 days)" : "Tag-ulan (14–21 days)"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Next Watering Due</span>
                  <p className="text-xs font-black text-emerald-400 mt-0.5">
                    {prediction?.nextRecommendedWateringDate}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {prediction?.actionPlan.map((act, i) => (
                  <div key={i} className="bg-white/10 rounded-xl p-3.5 border border-white/10 space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                      <i className="fa-solid fa-circle-arrow-right text-[8px]"></i>
                      {act.priority} priority
                    </span>
                    <p className="text-xs font-bold text-white">{act.tagalogAction}</p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{act.tagalogReason}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2.5">
              <button
                onClick={() => recordWatering()}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <i className="fa-solid fa-droplet text-xs"></i>
                I Have Watered The Aloe Vera (Reset)
              </button>
              <p className="text-[10px] text-slate-400 text-center">
                Updates moisture reading and resets drought tracking to Day 0
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-book-open text-emerald-600"></i>
            Aloe Vera Environmental Stress Reference Matrix
          </h3>
          <span className="text-xs text-slate-400 font-medium">Standard Agronomic Benchmarks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠️</span> 10–14 Days (Delayed Watering)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">Mild Stress</span>
            </div>
            <p className="text-slate-600 text-[11px]">Kapag hindi nadiligan sa matinding init:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Leaves medyo numinipis (thinning)</li>
              <li>Bahagyang lumalambot (slight softening)</li>
              <li>Mabagal ang growth</li>
              <li><strong>Mabilis makabawi</strong> kapag diniligan</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-orange-900 flex items-center gap-1.5">
                <span>❗</span> 15–21 Days (Matagal na Walang Tubig)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-200/80 text-orange-900">High Stress</span>
            </div>
            <p className="text-slate-600 text-[11px]">Matagal nang walang tubig sa init:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Leaves kulubot / shriveled</li>
              <li>Tips nagiging brown o tuyo</li>
              <li>Leaves maaaring bumagsak (drooping)</li>
              <li><strong>Survival mode</strong> pero buhay pa</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-rose-900 flex items-center gap-1.5">
                <span>🚨</span> Lampas 3–4 Weeks (Severe Drought)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900">Critical</span>
            </div>
            <p className="text-slate-600 text-[11px]">Severe drought + matinding init:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Leaves sobrang nipis at tuyo</li>
              <li>Ibabang mga dahon natutuyo at namamatay</li>
              <li>May banta ng root damage</li>
              <li><strong>Mataas ang chance</strong> na hindi na makarecover</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-purple-900 flex items-center gap-1.5">
                <span>🌧️</span> Overwatering / Tag-ulan
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200/80 text-purple-900">Root Rot Risk</span>
            </div>
            <p className="text-slate-600 text-[11px]">Watered too often / persistent basang lupa:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Peligro ng <strong>Root rot</strong> (nabubulok ang ugat)</li>
              <li>Yellow, soft, mushy leaves</li>
              <li>Plant may collapse and die</li>
              <li>Tag-ulan interval: every 14–21 days</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-red-900 flex items-center gap-1.5">
                <span>🔥</span> Heat & Sunburn (&gt;35°C / Full Sun)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-200/80 text-red-900">Heat / UV</span>
            </div>
            <p className="text-slate-600 text-[11px]">Matinding sikat ng araw sa tanghali:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Sunburn: mapula o brown na mga batik sa dahon</li>
              <li>Curled & brown leaf tips sa init</li>
              <li>Hindi gusto ang buong araw na direct sun</li>
              <li>Maglagay ng 30–50% shade cloth</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-cyan-200 bg-cyan-50/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-cyan-900 flex items-center gap-1.5">
                <span>❄️</span> Cold / Highland Stress (&lt;12°C)
              </h4>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-200/80 text-cyan-900">Cold Stress</span>
            </div>
            <p className="text-slate-600 text-[11px]">Bihira sa PH maliban sa highland areas:</p>
            <ul className="list-disc list-inside text-[11px] text-slate-700 space-y-1 pl-1">
              <li>Titigil o babagal ang paglaki ng aloe</li>
              <li>Leaves soften from cold temperature</li>
              <li>Tumatataas ang banta ng rot kapag basa</li>
              <li>Iwasan ang pagdilig tuwing malamig</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-500/20 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg border border-indigo-500/30">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
            </span>
            <div>
              <h3 className="text-base font-bold text-white">Google Gemini Agricultural Prognosis</h3>
              <p className="text-xs text-indigo-200">
                AI agronomist synthesizing 7-day forecast & microclimate telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {aiReport && (
              <div className="bg-white/10 rounded-xl p-0.5 flex items-center text-xs border border-white/10">
                <button
                  onClick={() => setAiLanguage("tl")}
                  className={`px-3 py-1 rounded-lg transition font-medium ${
                    aiLanguage === "tl" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                  }`}
                >
                  🇵🇭 Tagalog
                </button>
                <button
                  onClick={() => setAiLanguage("en")}
                  className={`px-3 py-1 rounded-lg transition font-medium ${
                    aiLanguage === "en" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>
            )}

            <button
              onClick={handleGenerateAiPrognosis}
              disabled={isAiLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <i className={`fa-solid fa-rotate ${isAiLoading ? "animate-spin" : ""}`}></i>
              {isAiLoading ? "Analyzing Telemetry..." : "Generate AI Agronomist Report"}
            </button>
          </div>
        </div>

        {aiReport && (
          <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <i className="fa-solid fa-location-dot text-xs text-indigo-400"></i>
                Location: {farmLocation.name} Outlook
              </span>
              <span className="text-xs font-semibold px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Risk Classification: {aiReport.riskLevel}
              </span>
            </div>

            <div className="space-y-2 bg-black/20 rounded-xl p-4 border border-white/5">
              <p className="text-sm font-medium text-white leading-relaxed">
                {aiLanguage === "tl" ? aiReport.tagalogPrognosis : aiReport.prognosis}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                  Primary Agronomist Action
                </span>
                <p className="text-xs font-bold text-white">
                  {aiLanguage === "tl" ? aiReport.tagalogRecommendedAction : aiReport.recommendedAction}
                </p>
              </div>

              <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">
                  5–7 Day Leaf Condition Outlook
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">{aiReport.leafOutlook}</p>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-indigo-200/80 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Weather correlation: {aiReport.weatherImpactAnalysis}</span>
              <span className="text-[10px] text-slate-400">Powered by Google Gemini 2.5 Flash</span>
            </div>
          </div>
        )}

        {!aiReport && !isAiLoading && (
          <p className="text-xs text-indigo-200/70 bg-white/5 rounded-xl p-4 border border-white/5 text-center leading-relaxed">
            Click <strong>Generate AI Agronomist Report</strong> to run Google Gemini 2.5 Flash over your multi-day telemetry and 7-day forecast.
          </p>
        )}
      </div>
    </section>
  );
}
