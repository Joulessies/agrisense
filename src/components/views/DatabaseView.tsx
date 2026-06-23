"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

export function DatabaseView() {
  const { role, addActivity } = useStore();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<any[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      console.error(err);
      addActivity(`Failed to load readings: ${err.message}`, "warning");
    } finally {
      setLoading(false);
    }
  };

  const insertTestRow = async () => {
    try {
      const { error } = await supabase.from("sensor_readings").insert([{
        device_id: "demo-node-1",
        soil_moisture: Math.floor(Math.random() * 20) + 20,
        temperature: Math.floor(Math.random() * 10) + 22,
        humidity: Math.floor(Math.random() * 30) + 40,
        lux: Math.floor(Math.random() * 10000) + 5000,
      }]);
      
      if (error) throw error;
      addActivity("Inserted test row successfully", "ok");
      fetchRows(); // refresh table
    } catch (err: any) {
      console.error(err);
      addActivity(`Failed to insert row: ${err.message}`, "warning");
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              defaultValue={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
              disabled
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Anon key</label>
            <input
              type="password"
              defaultValue={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}
              disabled
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
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              disabled={!isAdmin}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-2 flex flex-col gap-2">
            <button 
              onClick={fetchRows}
              disabled={loading}
              className="w-full text-sm px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium disabled:opacity-60 transition"
            >
              <i className={`fa-solid fa-cloud-arrow-down mr-1 ${loading ? 'fa-spin' : ''}`}></i> Load
            </button>
            {isAdmin && (
              <button 
                onClick={insertTestRow}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition"
              >
                <i className="fa-solid fa-flask mr-1"></i> Test row
              </button>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-96">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
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
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                      No rows found in sensor_readings.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-500">{row.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(row.recorded_at).toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium">{row.device_id}</td>
                      <td className="px-3 py-2">{row.soil_moisture ?? '—'}</td>
                      <td className="px-3 py-2">{row.temperature ?? '—'}</td>
                      <td className="px-3 py-2">{row.humidity ?? '—'}</td>
                      <td className="px-3 py-2">{row.lux ?? row.light_lux ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
