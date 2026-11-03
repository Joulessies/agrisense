"use client";

import React, { useState, useEffect } from "react";
import { fetchSensorAnomalies, AnomalyIncident } from "@/services/anomalyService";

interface AnomaliesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRange?: "7d" | "30d" | "season";
}

export function AnomaliesHistoryModal({
  isOpen,
  onClose,
  initialRange = "7d",
}: AnomaliesHistoryModalProps) {
  const [selectedRange, setSelectedRange] = useState<"7d" | "30d" | "90d">(
    initialRange === "season" ? "90d" : initialRange === "30d" ? "30d" : "7d"
  );
  const [filterTone, setFilterTone] = useState<"all" | "critical" | "warning">("all");
  const [filterSensor, setFilterSensor] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<"all" | "high" | "below">("all");
  const [anomalies, setAnomalies] = useState<AnomalyIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchSensorAnomalies(selectedRange);
        if (mounted) {
          setAnomalies(data);
        }
      } catch (err) {
        console.error("Failed to load anomalies log:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [isOpen, selectedRange]);

  if (!isOpen) return null;

  const filtered = anomalies.filter((a) => {
    if (filterTone !== "all" && a.tone !== filterTone) return false;
    if (filterSensor !== "all" && a.sensorId !== filterSensor) return false;
    if (filterDirection !== "all" && a.direction !== filterDirection) return false;
    return true;
  });

  const highCount = anomalies.filter((a) => a.direction === "high").length;
  const belowCount = anomalies.filter((a) => a.direction === "below").length;

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Timestamp",
      "Sensor",
      "Condition",
      "Value",
      "Optimal Range",
      "Severity",
      "Anomaly Description",
    ];
    const rows = filtered.map((a) => [
      `"${a.time}"`,
      `"${a.sensor}"`,
      `"${a.direction === "high" ? "HIGH (ABOVE OPTIMAL)" : "BELOW (UNDER OPTIMAL)"}"`,
      `"${a.value != null ? `${a.value}${a.unit || ""}` : "—"}"`,
      `"${a.optimal || "—"}"`,
      `"${a.tone.toUpperCase()}"`,
      `"${a.text.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agrisense_sensor_anomalies_${selectedRange}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSensorIcon = (sensorId?: string) => {
    switch (sensorId) {
      case "soilMoisture":
        return "fa-droplet text-emerald-600";
      case "temperature":
        return "fa-temperature-half text-amber-600";
      case "humidity":
        return "fa-water text-cyan-600";
      case "light":
        return "fa-sun text-yellow-500";
      default:
        return "fa-microchip text-slate-500";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-triangle-exclamation text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">Anomalies Detected History</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                  {anomalies.length} Logged
                </span>
                {anomalies.length > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {highCount} High · {belowCount} Below
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Out-of-range sensor incidents, critical spikes, and environmental stress timestamps.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5">
          {/* Time range buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedRange("7d")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "7d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setSelectedRange("30d")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "30d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setSelectedRange("90d")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "90d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 90 Days
            </button>
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Sensor selector */}
            <select
              value={filterSensor}
              onChange={(e) => setFilterSensor(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Sensors</option>
              <option value="soilMoisture">Soil Moisture</option>
              <option value="temperature">Temperature</option>
              <option value="humidity">Humidity</option>
              <option value="light">Light Intensity</option>
            </select>

            {/* Direction selector: Below vs High */}
            <select
              value={filterDirection}
              onChange={(e) => setFilterDirection(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Below & High</option>
              <option value="high">High Only (Above)</option>
              <option value="below">Below Only (Low)</option>
            </select>

            {/* Severity selector */}
            <select
              value={filterTone}
              onChange={(e) => setFilterTone(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings Only</option>
            </select>

            {/* Export CSV button */}
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
              title="Export anomaly report to CSV"
            >
              <i className="fa-solid fa-file-csv text-emerald-600"></i>
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-14 text-center text-slate-400 space-y-2">
              <i className="fa-solid fa-rotate animate-spin text-2xl text-slate-300"></i>
              <p className="text-xs font-medium">Scanning sensor telemetry for out-of-range anomalies…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <i className="fa-solid fa-shield-halved text-xl"></i>
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Sensor Anomalies Detected</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All sensor parameters (soil moisture, temperature, humidity, and light) remained within safe biological ranges during the selected {selectedRange === "90d" ? "90-day" : selectedRange === "30d" ? "30-day" : "7-day"} period.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isCrit = item.tone === "critical";
              const isHigh = item.direction === "high";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 transition ${
                    isCrit
                      ? "bg-rose-50/70 border-rose-200 text-rose-950"
                      : "bg-amber-50/60 border-amber-200 text-amber-950"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs mt-0.5 ${
                        isCrit ? "bg-rose-200/80 text-rose-700" : "bg-amber-200/80 text-amber-700"
                      }`}
                    >
                      <i className={`fa-solid ${isCrit ? "fa-circle-exclamation" : "fa-triangle-exclamation"}`}></i>
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Sensor Name */}
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/90 border border-slate-200/60 text-slate-700 flex items-center gap-1">
                          <i className={`fa-solid ${getSensorIcon(item.sensorId)} text-[10px]`}></i>
                          {item.sensor}
                        </span>

                        {/* HIGH vs BELOW Badge */}
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                            isHigh
                              ? "bg-rose-600 text-white"
                              : "bg-sky-600 text-white"
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              isHigh ? "fa-arrow-trend-up" : "fa-arrow-trend-down"
                            } text-[8px]`}
                          ></i>
                          {isHigh ? "High" : "Below"}
                        </span>

                        {/* Tone Badge */}
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isCrit
                              ? "bg-rose-100 text-rose-700 border border-rose-300"
                              : "bg-amber-100 text-amber-800 border border-amber-300"
                          }`}
                        >
                          {item.tone}
                        </span>
                      </div>

                      {/* Explicit description with value and optimal range */}
                      <p className="text-xs font-medium leading-relaxed text-slate-800">
                        {item.text}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-500 shrink-0 text-right whitespace-nowrap">
                    <i className="fa-solid fa-clock text-[10px] mr-1 text-slate-400"></i>
                    {item.time}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {anomalies.length} sensor incidents in the last {selectedRange === "90d" ? "90 days" : selectedRange === "30d" ? "30 days" : "7 days"}.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
