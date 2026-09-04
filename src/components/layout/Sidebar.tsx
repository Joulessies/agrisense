"use client";

import { useStore } from "@/store/useStore";
import React from "react";

export function Sidebar() {
  const { role, currentView, setCurrentView, sensors, dismissedAlerts, nodes } = useStore();

  const activeAlertsCount = Object.values(sensors).filter((s) => {
    const isOut = s.value < s.optimal.min || s.value > s.optimal.max;
    return isOut && !dismissedAlerts.has(s.id);
  }).length;

  const nodeCount = nodes.length;

  const mainNavItems = [
    { id: "dashboard", label: "Dashboard", icon: "fa-gauge-high" },
    { id: "predictions", label: "Crop Predictor", icon: "fa-wand-magic-sparkles" },
    { id: "sensors", label: "Sensors", icon: "fa-microchip" },
    { id: "alerts", label: "Alerts", icon: "fa-bell", badge: activeAlertsCount },
    { id: "analytics", label: "Analytics", icon: "fa-chart-column" },
  ];

  const secondaryNavItems = [
    { id: "settings", label: role === "admin" ? "Settings" : "Target Thresholds", icon: "fa-sliders" },
  ];

  const adminNavItems = [
    { id: "users", label: "User Accounts", icon: "fa-users" },
    { id: "database", label: "Database Telemetry", icon: "fa-database" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col fixed h-screen z-20">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-500 to-agri-600 flex items-center justify-center shadow-md">
          <i className="fa-solid fa-leaf text-white text-lg"></i>
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold bg-gradient-to-r from-agri-800 to-agri-600 bg-clip-text text-transparent">
            AgriSense
          </p>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded ${
              role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {role === "admin" ? "Admin Portal" : "Farmer Field"}
          </span>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto space-y-4">
        <div>
          <p className="px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Farm Monitoring
          </p>
          {mainNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-semibold border-l-4 transition ${
                  isActive
                    ? "bg-agri-50/80 text-agri-700 border-agri-600"
                    : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
                }`}
              >
                <i className={`fa-solid ${item.icon} w-5 text-sm ${isActive ? "text-agri-600" : "text-slate-400"}`}></i>
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {role === "admin" && (
          <div>
            <p className="px-6 text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-2">
              Administration
            </p>
            {adminNavItems.map((item) => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-semibold border-l-4 transition ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border-indigo-600"
                      : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
                  }`}
                >
                  <i className={`fa-solid ${item.icon} w-5 text-sm ${isActive ? "text-indigo-600" : "text-slate-400"}`}></i>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div>
          <p className="px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Configuration
          </p>
          {secondaryNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm font-semibold border-l-4 transition ${
                  isActive
                    ? "bg-agri-50/80 text-agri-700 border-agri-600"
                    : "text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-900"
                }`}
              >
                <i className={`fa-solid ${item.icon} w-5 text-sm ${isActive ? "text-agri-600" : "text-slate-400"}`}></i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="m-4 p-4 rounded-2xl bg-gradient-to-br from-agri-700 to-agri-900 text-white shadow-md">
        <div className="flex items-center gap-2 mb-1.5">
          <i className="fa-solid fa-leaf text-agri-300"></i>
          <p className="text-sm font-bold">Aloe Vera Zone #1</p>
        </div>
        <p className="text-xs text-agri-200 mb-3">{nodeCount} online sensor nodes</p>
        <button
          onClick={() => setCurrentView("sensors")}
          className="w-full text-xs bg-white/15 hover:bg-white/25 text-white transition py-2 rounded-lg font-semibold"
        >
          Inspect Nodes
        </button>
      </div>
    </aside>
  );
}
