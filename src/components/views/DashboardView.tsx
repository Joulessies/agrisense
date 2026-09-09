"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { SensorCard } from "@/components/ui/SensorCard";
import { PlantStatusCard } from "@/components/ui/PlantStatusCard";
import { HarvestCard } from "@/components/ui/HarvestCard";
import { RecommendationsCard } from "@/components/ui/RecommendationsCard";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { WeatherCard } from "@/components/ui/WeatherCard";
import { AiInsightsCard } from "@/components/ui/AiInsightsCard";
import { CropPredictionCard } from "@/components/ui/CropPredictionCard";
import { AloeVitalityCard } from "@/components/ui/AloeVitalityCard";
import { AloeCareMatrixModal } from "@/components/ui/AloeCareMatrixModal";
import { FarmHealthReportModal } from "@/components/ui/FarmHealthReportModal";
import { LiveHardwareConnectModal } from "@/components/ui/LiveHardwareConnectModal";
import { getStatus, calculateAloeVitality } from "@/lib/utils";

export function DashboardView() {
  const {
    auth,
    role,
    sensors,
    plant,
    nodes,
    profiles,
    setCurrentView,
    syncNow,
    isSyncing,
    realtimeStatus,
    livePacketCount,
    streamLatency,
    lanIp,
  } = useStore();

  const userName = auth.currentUser?.name?.split(" ")[0] || "User";
  const userCount = profiles.length;
  const nodeCount = nodes.length;
  const activeNodes = nodes.filter((n) => n.online).length;

  const outOfRangeCount = Object.values(sensors).filter((s) => getStatus(s) !== "ok").length;
  const optimalCount = Object.values(sensors).length - outOfRangeCount;

  const [showCareMatrix, setShowCareMatrix] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { score: vitalityScore, status: vitalityStatus } = calculateAloeVitality(sensors);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      syncNow();
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, syncNow]);

  const handleQuickRefresh = async () => {
    await syncNow();
  };

  const isConnected = realtimeStatus === "connected";

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
              isConnected
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs"
            }`}
            title="Configure ESP32 hardware IP and live streaming parameters"
          >
            <span className="relative flex h-2 w-2">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected ? "bg-emerald-500" : "bg-slate-400"
                }`}
              ></span>
            </span>
            <i className="fa-solid fa-wifi text-xs text-agri-600"></i>
            <span>{isConnected ? "Hardware Live Link" : "Connect ESP32"}</span>
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              autoRefresh
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}
            title="Toggle high-speed background telemetry polling"
          >
            <span className="relative flex h-2 w-2">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  autoRefresh ? "bg-emerald-500" : "bg-slate-400"
                }`}
              ></span>
            </span>
            <span>Live: {autoRefresh ? "4s" : "Manual"}</span>
          </button>

          <button
            type="button"
            onClick={handleQuickRefresh}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 shadow-sm flex items-center gap-2 transition disabled:opacity-60 cursor-pointer"
          >
            <i className={`fa-solid fa-arrows-rotate text-xs text-agri-600 ${isSyncing ? "animate-spin" : ""}`}></i>
            <span>{isSyncing ? "Refreshing..." : "Refresh Data"}</span>
          </button>

          {role === "admin" ? (
            <button
              onClick={() => setCurrentView("users")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <i className="fa-solid fa-user-gear text-xs"></i> Manage Users
            </button>
          ) : (
            <button
              onClick={() => setCurrentView("alerts")}
              className="px-4 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition cursor-pointer"
            >
              <i className="fa-solid fa-bell text-xs"></i> View Alerts ({outOfRangeCount})
            </button>
          )}
        </div>
      </div>

      {isConnected && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-950">Real-Time Telemetry Streaming Active</span>
            <span className="text-emerald-400 hidden sm:inline">•</span>
            <span className="text-emerald-700 hidden sm:inline">
              Hardware node ({lanIp || "ESP32"}) synchronized with Supabase Realtime
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-emerald-800">
            <span>Packets: <strong className="text-emerald-950">{livePacketCount}</strong></span>
            {streamLatency != null && <span>Latency: <strong className="text-emerald-950">{streamLatency}ms</strong></span>}
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="underline hover:text-emerald-950 font-sans font-semibold cursor-pointer ml-1"
            >
              Stream Settings
            </button>
          </div>
        </div>
      )}

      {role === "admin" ? (
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 shadow-inner">
                <i className="fa-solid fa-shield-halved text-white text-xl"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">System Administration Overview</h3>
                <p className="text-indigo-100 text-xs mt-1 max-w-xl leading-relaxed">
                  Full control enabled. You can register new farm personnel, edit environmental alert thresholds, and monitor database telemetry.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <button
                    onClick={() => setCurrentView("users")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-users text-xs"></i> Users Directory
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-sliders text-xs"></i> Configure Thresholds
                  </button>
                  <button
                    onClick={() => setCurrentView("database")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fa-solid fa-database text-xs"></i> Database Logs
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className="text-2xl font-bold text-white leading-none">{userCount}</p>
                <p className="text-[10px] text-indigo-200 mt-1 uppercase font-semibold tracking-wider">Users</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className="text-2xl font-bold text-white leading-none">{nodeCount}</p>
                <p className="text-[10px] text-indigo-200 mt-1 uppercase font-semibold tracking-wider">Nodes</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3.5 text-center min-w-[90px] border border-white/10">
                <p className="text-2xl font-bold text-emerald-300 leading-none">{optimalCount}/4</p>
                <p className="text-[10px] text-indigo-200 mt-1 uppercase font-semibold tracking-wider">Optimal</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
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

      <CropPredictionCard />

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
      <LiveHardwareConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </section>
  );
}
