"use client";

import { useStore } from "@/store/useStore";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { LiveHardwareConnectModal } from "@/components/ui/LiveHardwareConnectModal";

export function Header() {
  const { currentView, role, auth, realtimeStatus, lastSync, isSyncing, syncNow, logout } = useStore();
  const router = useRouter();
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: "Dashboard", subtitle: "Real-time overview of your aloe vera crop" },
    predictions: { title: "Crop Predictor & Weather Outlook", subtitle: "7-day microclimate weather correlation and physical outcome simulator" },
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

  const diffMs = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity;
  const isFresh = diffMs < 120000;
  const isConnected = realtimeStatus === "connected" && isFresh;

  const statusLabel = isConnected
    ? "Real-Time: Active"
    : realtimeStatus === "connected"
    ? "Real-Time: Connected"
    : "Real-Time: Offline";

  const statusDotColor = isConnected
    ? "bg-emerald-500"
    : realtimeStatus === "connected"
    ? "bg-amber-400"
    : "bg-slate-400";

  const formatSyncTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const getRelativeTime = (date: Date) => {
    const sec = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (sec < 15) return "Just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="hidden md:flex items-center gap-2 text-xs py-1.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
            title="Click to view IoT hardware connection and streaming settings"
          >
            <span className="relative flex w-2.5 h-2.5">
              {isConnected && (
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              )}
              <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${statusDotColor}`}></span>
            </span>
            <span className="font-semibold text-slate-800">{statusLabel}</span>
            <i className="fa-solid fa-sliders text-[10px] text-slate-400 ml-0.5"></i>
          </button>

          <span className="hidden md:inline text-slate-300">•</span>

          <button
            type="button"
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="hidden md:flex items-center gap-2 text-xs text-slate-500 hover:text-slate-800 transition disabled:opacity-60 cursor-pointer"
            title="Click to fetch latest telemetry from Supabase & LAN"
          >
            <span>
              Last sync:{" "}
              <span className="text-slate-700 font-medium">{formatSyncTime(lastSync)}</span>
              <span className="text-slate-400 text-[11px] ml-1">({getRelativeTime(lastSync)})</span>
            </span>
            <i
              className={`fa-solid fa-arrows-rotate text-[10px] text-slate-400 hover:text-agri-600 ml-0.5 ${
                isSyncing ? "animate-spin text-agri-600" : ""
              }`}
            ></i>
          </button>

          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
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

      <LiveHardwareConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </>
  );
}
