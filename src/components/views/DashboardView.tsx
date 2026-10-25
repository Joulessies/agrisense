"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { SensorCard } from "@/components/ui/SensorCard";
import { PlantStatusCard } from "@/components/ui/PlantStatusCard";
import { HarvestCard } from "@/components/ui/HarvestCard";
import { RecommendationsCard } from "@/components/ui/RecommendationsCard";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { WeatherCard } from "@/components/ui/WeatherCard";
import { AiInsightsCard } from "@/components/ui/AiInsightsCard";
import { AloeVitalityCard } from "@/components/ui/AloeVitalityCard";
import { AloeCareMatrixModal } from "@/components/ui/AloeCareMatrixModal";
import { FarmHealthReportModal } from "@/components/ui/FarmHealthReportModal";
import { getStatus, calculateAloeVitality } from "@/lib/utils";

export function DashboardView() {
  const {
    auth,
    role,
    sensors,
    plant,
    nodes,
    setCurrentView,
  } = useStore();

  const userName = auth.currentUser?.name?.split(" ")[0] || "User";
  const activeNodes = nodes.filter((n) => n.online).length;

  const disconnectedSensors = Object.values(sensors).filter((s) => s.value === null || getStatus(s) === "disconnected");
  const outOfRangeCount = Object.values(sensors).filter((s) => getStatus(s) !== "ok" && getStatus(s) !== "disconnected").length;

  const [showCareMatrix, setShowCareMatrix] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { score: vitalityScore, status: vitalityStatus } = calculateAloeVitality(sensors);

  return (
    <section className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, {userName}</h2>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                role === "admin"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              {role === "admin" ? "Admin Workspace" : "Farmer Field View"}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            {role === "admin"
              ? "System telemetry, user access, and greenhouse environment controls."
              : "Live monitoring and smart AGI agronomist recommendations for your aloe vera crop."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentView("predictions")}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
            title="Inspect trained Bi-LSTM model architecture, metrics, and actual-vs-predicted curves"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <i className="fa-solid fa-brain text-xs"></i>
            <span>LSTM Neural Model (R² 88.8%)</span>
          </button>
        </div>
      </div>

      {disconnectedSensors.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-rose-950 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <i className="fa-solid fa-plug-circle-xmark text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-rose-900">
                  Hardware Sensor Offline: {disconnectedSensors.map((s) => s.label).join(", ")}
                </h4>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full">
                  Disconnected
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-0.5">
                The ESP32 is not receiving telemetry from this sensor. Value is rendered as &ldquo;—&rdquo; (offline). Check jumper wires on ESP32 breadboard (DHT22 on Pin 4, BH1750 I2C, Soil ADC Pin 34).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => setCurrentView("sensors")}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-microchip text-xs"></i> Check Node Pinout
            </button>
          </div>
        </div>
      )}

      {role !== "admin" && (
        <div className="bg-gradient-to-r from-emerald-700 via-agri-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 shadow-inner">
                <i className="fa-solid fa-leaf text-white text-xl"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Greenhouse Farm Monitor</h3>
                <p className="text-emerald-100 text-xs mt-1 max-w-xl leading-relaxed">
                  Real-time aloe vera health telemetry. Sensor readings below or above target range will trigger immediate alerts and actionable agronomist tips.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <button
                    onClick={() => setCurrentView("sensors")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-microchip text-xs"></i> Check Sensor Nodes
                  </button>
                  <button
                    onClick={() => setCurrentView("analytics")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-chart-line text-xs"></i> View Analytics
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-circle-info text-xs"></i> Target Thresholds
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className="text-2xl font-bold text-white leading-none">{plant.age}</p>
                <p className="text-[10px] text-emerald-100 mt-1 uppercase font-semibold tracking-wider">Days Old</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className="text-2xl font-bold text-white leading-none">{activeNodes}</p>
                <p className="text-[10px] text-emerald-100 mt-1 uppercase font-semibold tracking-wider">Active Nodes</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className={`text-2xl font-bold leading-none ${outOfRangeCount > 0 ? "text-amber-300" : "text-white"}`}>
                  {outOfRangeCount === 0 ? "Optimal" : `${outOfRangeCount} Alert`}
                </p>
                <p className="text-[10px] text-emerald-100 mt-1 uppercase font-semibold tracking-wider">Crop Status</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <AloeVitalityCard
        onOpenMatrix={() => setShowCareMatrix(true)}
        onOpenReport={() => setShowReportModal(true)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {Object.values(sensors).map((sensor) => (
          <SensorCard key={sensor.id} sensor={sensor} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <PlantStatusCard />
        <HarvestCard />
        <WeatherCard />
        <RecommendationsCard />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <AiInsightsCard />
      </div>

      <ActivityFeed />

      <AloeCareMatrixModal isOpen={showCareMatrix} onClose={() => setShowCareMatrix(false)} />
      <FarmHealthReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        vitalityScore={vitalityScore}
        vitalityStatus={vitalityStatus}
      />

    </section>
  );
}
