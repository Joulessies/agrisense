"use client";

import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import React from "react";

export function Header() {
  const { currentView, role, auth, realtimeStatus, lastSync, logout } = useStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: "Dashboard", subtitle: "Real-time overview of your aloe vera crop" },
    sensors: { title: "Sensors", subtitle: "Detailed sensor node metrics" },
    alerts: { title: "Alerts", subtitle: "Active warnings and critical conditions" },
    analytics: { title: "Analytics", subtitle: "Insights and trends across your crop's vital signs" },
    database: { title: "Database", subtitle: "System logs and database records" },
    settings: { title: "Settings", subtitle: "Application configuration and thresholds" },
    users: { title: "User Management", subtitle: "Configure credentials, names, and system roles" },
  };

  const { title, subtitle } = titles[currentView] || titles["dashboard"];

  const userInitial = auth.currentUser?.name?.charAt(0) || "U";
  const userName = auth.currentUser?.name || "User";
  const userRole = role === "admin" ? "Administrator" : "Field Operator";
  
  const isRealtime = realtimeStatus === "connected";

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-5">
        <div
          className="hidden md:flex items-center gap-2 text-xs text-slate-500"
          title="Supabase WebSocket Realtime Status"
        >
          <span className="relative flex w-2.5 h-2.5">
            {isRealtime && (
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
            )}
            <span
              className={`relative inline-flex w-2.5 h-2.5 rounded-full ${
                isRealtime ? "bg-emerald-500" : "bg-slate-400"
              }`}
            ></span>
          </span>
          <span>{isRealtime ? "Real-Time: Active" : "Real-Time: Offline"}</span>
        </div>
        <span className="hidden md:inline text-slate-300">•</span>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500" title="Last data sync">
          <span className="relative flex w-2.5 h-2.5">
            {isRealtime && (
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
            )}
            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${isRealtime ? "bg-emerald-500" : "bg-amber-400"}`}></span>
          </span>
          <span>
            Last sync:{" "}
            <span className="text-slate-700 font-medium">
              {lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </span>
        </div>

        <button 
          onClick={handleLogout}
          className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
          <i className="fa-solid fa-right-from-bracket"></i> Logout
        </button>
        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-colors duration-300 bg-agri-600">
            {userInitial}
          </div>
          <div className="hidden lg:block leading-tight">
            <p className="text-sm font-semibold text-slate-800">{userName}</p>
            <p className="text-[11px] text-slate-500">{userRole}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
