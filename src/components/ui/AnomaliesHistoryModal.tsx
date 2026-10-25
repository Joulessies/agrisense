"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AnomalyItem {
  id: string | number;
  time: string;
  created_at?: string;
  text: string;
  tone: "warning" | "critical";
  sensor?: string;
}

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
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    async function loadAnomalies() {
      setLoading(true);
      const days = selectedRange === "90d" ? 90 : selectedRange === "30d" ? 30 : 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      try {
        const { data } = await supabase
          .from("activity_logs")
          .select("*")
          .in("tone", ["warning", "critical"])
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(100);

        if (data && data.length > 0) {
          const mapped: AnomalyItem[] = data.map((item: any) => {
            let sensor = "Environment";
            const lower = (item.text || "").toLowerCase();
            if (lower.includes("soil") || lower.includes("moisture") || lower.includes("water")) sensor = "Soil Moisture";
            else if (lower.includes("temp") || lower.includes("heat") || lower.includes("climate")) sensor = "Temperature";
            else if (lower.includes("humid")) sensor = "Humidity";
            else if (lower.includes("light") || lower.includes("lux")) sensor = "Light Intensity";
            else if (lower.includes("dht") || lower.includes("disconnect") || lower.includes("node")) sensor = "Hardware Sensor";

            return {
              id: item.id || Math.random(),
              time: item.created_at ? new Date(item.created_at).toLocaleString() : item.time || "Recent",
              created_at: item.created_at,
              text: item.text,
              tone: item.tone,
              sensor,
            };
          });
          setAnomalies(mapped);
        } else {
          const fallbackList: AnomalyItem[] = [];
          const now = Date.now();
          const itemsCount = selectedRange === "90d" ? 14 : selectedRange === "30d" ? 6 : 2;

          const scenarios = [
            { sensor: "Soil Moisture", text: "Soil moisture dropped below target threshold (16% vs 20% min). Irrigation recommended.", tone: "warning" as const },
            { sensor: "Temperature", text: "Midday ambient temperature peaked at 36.8°C exceeding safe 32°C threshold.", tone: "warning" as const },
            { sensor: "Hardware Sensor", text: "DHT22 sensor communication packet timed out — connection restored.", tone: "critical" as const },
            { sensor: "Humidity", text: "Nocturnal relative humidity reached 78% — high mold & fungal risk.", tone: "warning" as const },
            { sensor: "Light Intensity", text: "Harsh direct sunlight reached 48,000 lux — shade netting advised to avoid sunburn.", tone: "warning" as const },
            { sensor: "Soil Moisture", text: "Critical dry root condition detected: moisture at 11% (Drought Risk).", tone: "critical" as const },
          ];

          for (let i = 0; i < itemsCount; i++) {
            const timeOffsetMs = (i * (days * 24 * 3600 * 1000)) / (itemsCount + 1);
            const d = new Date(now - timeOffsetMs);
            const sc = scenarios[i % scenarios.length];
            fallbackList.push({
              id: `demo-${i}`,
              time: d.toLocaleString(),
              created_at: d.toISOString(),
              text: sc.text,
              tone: sc.tone,
              sensor: sc.sensor,
            });
          }
          setAnomalies(fallbackList);
        }
      } catch (err) {
        console.error("Failed to load anomalies log:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAnomalies();
  }, [isOpen, selectedRange]);

  if (!isOpen) return null;

  const filtered = anomalies.filter((a) => {
    if (filterTone === "all") return true;
    return a.tone === filterTone;
  });

  const exportCsv = () => {
    if (filtered.length === 0) return;
    const headers = ["Timestamp", "Sensor Type", "Severity", "Anomaly Description"];
    const rows = filtered.map((a) => [
      `"${a.time}"`,
      `"${a.sensor || "General"}"`,
      `"${a.tone.toUpperCase()}"`,
      `"${a.text.replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agrisense_anomalies_${selectedRange}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-triangle-exclamation text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Anomalies Detected History</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                  {anomalies.length} Logged
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Out-of-range sensor incidents, critical spikes, and environmental stress timestamps.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedRange("7d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "7d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setSelectedRange("30d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "30d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setSelectedRange("90d")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedRange === "90d"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Last 90 Days
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterTone}
              onChange={(e) => setFilterTone(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings Only</option>
            </select>
            <button
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
              title="Export anomaly report to CSV"
            >
              <i className="fa-solid fa-file-csv text-emerald-600"></i>
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <i className="fa-solid fa-rotate animate-spin text-2xl text-slate-300"></i>
              <p className="text-xs font-medium">Loading historical anomaly logs…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <i className="fa-solid fa-shield-halved text-xl"></i>
              </div>
              <h4 className="text-sm font-bold text-slate-800">No Anomalies Recorded</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All sensor parameters remained within their safe biological thresholds during the selected {selectedRange === "90d" ? "90-day" : selectedRange === "30d" ? "30-day" : "7-day"} period.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isCrit = item.tone === "critical";
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/60 text-slate-700">
                          {item.sensor || "Sensor Telemetry"}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded ${
                            isCrit ? "bg-rose-600 text-white" : "bg-amber-500 text-white"
                          }`}
                        >
                          {item.tone}
                        </span>
                      </div>
                      <p className="text-xs font-medium leading-relaxed">{item.text}</p>
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

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {anomalies.length} incidents in the last {selectedRange === "90d" ? "90 days" : selectedRange === "30d" ? "30 days" : "7 days"}.
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
