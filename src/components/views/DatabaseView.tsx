"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { FarmHealthReportModal } from "@/components/ui/FarmHealthReportModal";
import { calculateAloeVitality } from "@/lib/utils";

export function DatabaseView() {
  const { role, addActivity, sensors } = useStore();
  const isAdmin = role === "admin";
  const [showReportModal, setShowReportModal] = useState(false);
  const { score: vitalityScore, status: vitalityStatus } = calculateAloeVitality(sensors);
  const [rows, setRows] = useState<any[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("all");

  const deviceList = Array.from(new Set(rows.map((r) => r.device_id).filter(Boolean)));
  const filteredRows = selectedDevice === "all" ? rows : rows.filter((r) => r.device_id === selectedDevice);

  const exportToCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = ["ID", "Recorded At", "Device ID", "Soil Moisture (%)", "Temperature (°C)", "Humidity (%)", "Light (lux)"];
    const csvRows = [
      headers.join(","),
      ...filteredRows.map((r) =>
        [
          r.id,
          `"${r.recorded_at}"`,
          `"${r.device_id}"`,
          r.soil_moisture ?? "",
          r.temperature ?? "",
          r.humidity ?? "",
          r.lux ?? r.light_lux ?? "",
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agrisense_telemetry_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addActivity(`Exported ${filteredRows.length} telemetry readings to CSV`, "ok");
  };

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
      fetchRows();
    } catch (err: any) {
      console.error(err);
      addActivity(`Failed to insert row: ${err.message}`, "warning");
    }
  };

  useEffect(() => {
    fetchRows();

    const channel = supabase
      .channel("database_view_live_readings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        (payload) => {
          if (payload.new) {
            setRows((prev) => [payload.new, ...prev.slice(0, limit - 1)]);
          }
        }
      )
      .subscribe();

    const interval = setInterval(fetchRows, 5000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return (
    <section className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">Supabase cloud log</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Same <code className="font-mono text-[11px]">sensor_readings</code> table the ESP32 writes to (REST).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCsv}
              disabled={filteredRows.length === 0}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <i className="fa-solid fa-file-csv text-agri-600"></i> Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <i className="fa-solid fa-file-pdf text-emerald-400"></i> Export Audit PDF
            </button>
            <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              <i className="fa-solid fa-database mr-1"></i>PostgREST
            </span>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Project URL</label>
            <input
              type="url"
              defaultValue={process.env.NEXT_PUBLIC_SUPABASE_URL || ""}
              disabled
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Filter Device</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-agri-500/30"
            >
              <option value="all">All Devices ({rows.length})</option>
              {deviceList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
          <div className="sm:col-span-4 flex items-center gap-2">
            <button 
              onClick={fetchRows}
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium disabled:opacity-60 transition"
            >
              <i className={`fa-solid fa-cloud-arrow-down mr-1 ${loading ? 'fa-spin' : ''}`}></i> Load
            </button>
            {isAdmin && (
              <button 
                onClick={insertTestRow}
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium transition"
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
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                      No readings found for {selectedDevice === "all" ? "the selected query" : selectedDevice}.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
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

      <FarmHealthReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        vitalityScore={vitalityScore}
        vitalityStatus={vitalityStatus}
      />
    </section>
  );
}
