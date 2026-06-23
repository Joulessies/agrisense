"use client";

import React from "react";
import { useStore } from "@/store/useStore";

export function DatabaseView() {
  const { role } = useStore();
  const isAdmin = role === "admin";

  return (
    <section className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Supabase cloud log</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Same <code className="font-mono text-[11px]">sensor_readings</code> table the ESP32 writes to (REST).
            </p>
          </div>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
            <i className="fa-solid fa-database mr-1"></i>PostgREST
          </span>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Project URL</label>
            <input
              type="url"
              defaultValue="https://YOUR_PROJECT_REF.supabase.co"
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Anon key</label>
            <input
              type="password"
              defaultValue="eyJ..."
              disabled={!isAdmin}
              autoComplete="off"
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Rows</label>
            <input
              type="number"
              min="1"
              max="500"
              defaultValue="50"
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <button className="w-full text-sm px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium disabled:opacity-60 transition">
              <i className="fa-solid fa-cloud-arrow-down mr-1"></i> Load
            </button>
            {isAdmin && (
              <button className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition">
                <i className="fa-solid fa-flask mr-1"></i> Test row
              </button>
            )}
          </div>
        </div>
        {!isAdmin && (
          <p className="px-6 pb-2 text-amber-700 text-xs">
            <i className="fa-solid fa-lock mr-1"></i>Switch to <strong>Admin</strong> in the top header (next to Farmer) to edit Project URL and Anon key.
          </p>
        )}
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">ID</th>
                  <th className="px-3 py-2 font-semibold">Recorded At</th>
                  <th className="px-3 py-2 font-semibold">Device</th>
                  <th className="px-3 py-2 font-semibold">Moisture</th>
                  <th className="px-3 py-2 font-semibold">Temp</th>
                  <th className="px-3 py-2 font-semibold">Humidity</th>
                  <th className="px-3 py-2 font-semibold">Lux</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    No rows yet — save URL/key and click <strong>Load from Supabase</strong>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
