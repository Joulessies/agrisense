"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { SensorCard } from "@/components/ui/SensorCard";
import { PlantStatusCard } from "@/components/ui/PlantStatusCard";
import { HarvestCard } from "@/components/ui/HarvestCard";
import { RecommendationsCard } from "@/components/ui/RecommendationsCard";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { WeatherCard } from "@/components/ui/WeatherCard";
import { AiInsightsCard } from "@/components/ui/AiInsightsCard";
import { CropPredictionCard } from "@/components/ui/CropPredictionCard";
import { getStatus } from "@/lib/utils";

export function DashboardView() {
  const { auth, role, sensors, plant, nodes, profiles, setCurrentView, addActivity } = useStore();

  const userName = auth.currentUser?.name?.split(" ")[0] || "User";
  const userCount = profiles.length;
  const nodeCount = nodes.length;
  const activeNodes = nodes.filter((n) => n.online).length;

  const outOfRangeCount = Object.values(sensors).filter((s) => getStatus(s) !== "ok").length;
  const optimalCount = Object.values(sensors).length - outOfRangeCount;

  const handleQuickRefresh = () => {
    useStore.setState({ lastSync: new Date() });
    addActivity("Dashboard sensors refreshed", "info");
  };

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
              : "Live monitoring and smart agronomist recommendations for your aloe vera crop."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickRefresh}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 shadow-sm flex items-center gap-2 transition"
          >
            <i className="fa-solid fa-arrows-rotate text-xs text-agri-600"></i> Refresh Data
          </button>
          {role === "admin" ? (
            <button
              onClick={() => setCurrentView("users")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition"
            >
              <i className="fa-solid fa-user-gear text-xs"></i> Manage Users
            </button>
          ) : (
            <button
              onClick={() => setCurrentView("alerts")}
              className="px-4 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 transition"
            >
              <i className="fa-solid fa-bell text-xs"></i> View Alerts ({outOfRangeCount})
            </button>
          )}
        </div>
      </div>

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
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-users text-xs"></i> Users Directory
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-sliders text-xs"></i> Configure Thresholds
                  </button>
                  <button
                    onClick={() => setCurrentView("database")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
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
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-microchip text-xs"></i> Check Sensor Nodes
                  </button>
                  <button
                    onClick={() => setCurrentView("analytics")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-chart-line text-xs"></i> View Analytics
                  </button>
                  <button
                    onClick={() => setCurrentView("settings")}
                    className="text-xs bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
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
    </section>
  );
}
