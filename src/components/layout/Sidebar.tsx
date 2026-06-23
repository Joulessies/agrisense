"use client";

import { useStore } from "@/store/useStore";
import React from "react";

export function Sidebar() {
  const { role, currentView, setCurrentView, sensors, dismissedAlerts, nodes } = useStore();

  const activeAlertsCount = Object.values(sensors).filter(s => {
    const isOut = s.value < s.optimal.min || s.value > s.optimal.max;
    return isOut && !dismissedAlerts.has(s.id);
  }).length;

  const nodeCount = nodes.length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "fa-gauge-high" },
    { id: "sensors", label: "Sensors", icon: "fa-microchip" },
    { id: "alerts", label: "Alerts", icon: "fa-bell", badge: activeAlertsCount },
    { id: "analytics", label: "Analytics", icon: "fa-chart-column" },
    { id: "database", label: "Database", icon: "fa-database" },
    { id: "settings", label: "Settings", icon: "fa-gear" },
  ];

  if (role === "admin") {
    navItems.push({ id: "users", label: "Users", icon: "fa-users" });
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col fixed h-screen">
      <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-agri-100 flex items-center justify-center">
          <i className="fa-solid fa-seedling text-agri-600 text-lg"></i>
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">AgriSense</p>
          {/* Placeholder for custom logo per user request */}
        </div>
      </div>

      <nav className="flex-1 py-4">
        <p className="px-6 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Main Menu
        </p>
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full nav-link flex items-center gap-3 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 border-l-2 transition-colors ${
                isActive ? "active" : "text-slate-600 border-transparent"
              }`}
            >
              <i className={`nav-icon fa-solid ${item.icon} w-5 ${isActive ? "" : "text-slate-400"}`}></i>
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="m-4 p-4 rounded-xl bg-gradient-to-br from-agri-600 to-agri-700 text-white">
        <div className="flex items-center gap-2 mb-2">
          <i className="fa-solid fa-leaf"></i>
          <p className="text-sm font-semibold">Greenhouse #4</p>
        </div>
        <p className="text-xs text-agri-100 mb-3">{nodeCount} sensor nodes</p>
        <button className="text-xs bg-white/15 hover:bg-white/25 transition px-3 py-1.5 rounded-md font-medium">
          Manage devices
        </button>
      </div>
    </aside>
  );
}
