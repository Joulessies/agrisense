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

export function DashboardView() {
  const { auth, role, sensors, plant, nodes, profiles } = useStore();

  const userName = auth.currentUser?.name?.split(" ")[0] || "User";
  const userCount = profiles.length;
  const nodeCount = nodes.length;
  const activeNodes = nodes.filter((n) => n.online).length;

  return (
    <section className="p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Good morning, {userName}</h2>
          <p className="text-sm text-slate-500">Here's how your aloe vera field is doing right now.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-600 flex items-center gap-2 transition disabled:opacity-60">
            <i className="fa-solid fa-arrow-rotate-right text-xs"></i> Refresh
          </button>
          {role === "admin" && (
            <button className="px-3 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition">
              <i className="fa-solid fa-file-export text-xs"></i> Export report
            </button>
          )}
        </div>
      </div>

      {role === "admin" ? (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.35)]">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-shield-halved text-white text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Administrator Panel</p>
            <p className="text-indigo-200 text-xs mt-0.5">
              You have full system access. Manage users, thresholds, and device settings from the sidebar.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center bg-white/10 rounded-xl px-4 py-2">
              <p className="text-white text-lg font-bold leading-none">{userCount}</p>
              <p className="text-indigo-200 text-[10px] mt-0.5 uppercase tracking-wide">Users</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-2">
              <p className="text-white text-lg font-bold leading-none">{nodeCount}</p>
              <p className="text-indigo-200 text-[10px] mt-0.5 uppercase tracking-wide">Nodes</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.3)]">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-tractor text-white text-lg"></i>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">My Farm Today</p>
            <p className="text-emerald-100 text-xs mt-0.5">
              Monitor your aloe vera sensors in real-time. Contact your administrator to change thresholds or settings.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center bg-white/10 rounded-xl px-4 py-2">
              <p className="text-white text-lg font-bold leading-none">{plant.age}</p>
              <p className="text-emerald-100 text-[10px] mt-0.5 uppercase tracking-wide">Days Old</p>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-2">
              <p className="text-white text-lg font-bold leading-none">{activeNodes}</p>
              <p className="text-emerald-100 text-[10px] mt-0.5 uppercase tracking-wide">Active Nodes</p>
            </div>
          </div>
        </div>
      )}

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
    </section>
  );
}
