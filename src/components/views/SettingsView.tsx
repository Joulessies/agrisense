"use client";

import React from "react";
import { useStore } from "@/store/useStore";

export function SettingsView() {
  const { role, sensors } = useStore();
  const isAdmin = role === "admin";

  return (
    <section className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Sensor Thresholds</p>
          <p className="text-xs text-slate-500 mt-0.5">Configure the optimal operating ranges for your environment.</p>
        </div>
        <div className="px-6 py-2">
          {Object.values(sensors).map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center py-3 border-b border-slate-100 last:border-0"
            >
              <div className="sm:col-span-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                  <i className={`fa-solid ${s.icon} ${s.iconColor} text-xs`}></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{s.label}</p>
                  <p className="text-[11px] text-slate-500">{s.unit === "lux" ? "lux" : s.unit}</p>
                </div>
              </div>
              <div className="sm:col-span-4">
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Optimal min</label>
                <input
                  type="number"
                  defaultValue={s.optimal.min}
                  disabled={!isAdmin}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Optimal max</label>
                <input
                  type="number"
                  defaultValue={s.optimal.max}
                  disabled={!isAdmin}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
              <div className="sm:col-span-1 text-right">
                {isAdmin && (
                  <button
                    className="text-xs text-slate-400 hover:text-slate-600 transition"
                    title="Reset to default"
                  >
                    <i className="fa-solid fa-rotate-left"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
