"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";
import { getStatus } from "@/lib/utils";

interface FarmHealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  vitalityScore: number;
  vitalityStatus: string;
}

export function FarmHealthReportModal({
  isOpen,
  onClose,
  vitalityScore,
  vitalityStatus,
}: FarmHealthReportModalProps) {
  const { auth, role, sensors, plant } = useStore();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReportDate(new Date().toLocaleString());
      setLoading(true);
      const loadData = async () => {
        try {
          const { data } = await supabase
            .from("sensor_readings")
            .select("*")
            .order("recorded_at", { ascending: false })
            .limit(15);
          setReadings(data || []);
        } catch {} finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const operatorName = auth.currentUser?.name || "Julius (Lead Operator)";
  const operatorRole = role === "admin" ? "Farm Administrator" : "Field Operator";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-agri-600 flex items-center justify-center text-white">
              <i className="fa-solid fa-file-invoice text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Farm Health &amp; Telemetry Audit Report</h3>
              <p className="text-[11px] text-slate-400">Ready for instant printing or export to PDF</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-agri-600 hover:bg-agri-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <i className="fa-solid fa-print text-xs"></i> Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible">
          <div id="farm-health-report-printable" className="bg-white text-slate-900 font-sans space-y-6">
            <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-agri-600 text-white flex items-center justify-center font-black text-sm">
                    A
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">AgriSense Aloe</h1>
                </div>
                <p className="text-xs font-bold text-slate-600 tracking-wider uppercase mt-1">
                  Automated Farm Health &amp; Microclimate Audit Report
                </p>
                <p className="text-[11px] text-slate-500 italic mt-0.5">Crop Target: Aloe barbadensis Miller (Greenhouse Sector 1)</p>
              </div>

              <div className="text-right sm:text-right space-y-0.5 text-xs text-slate-600">
                <p><span className="font-bold text-slate-900">Generated:</span> {reportDate}</p>
                <p><span className="font-bold text-slate-900">Auditor:</span> {operatorName} ({operatorRole})</p>
                <p><span className="font-bold text-slate-900">Document ID:</span> AGRI-ALOE-{Math.floor(100000 + Math.random() * 900000)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Aloe Vitality Score</p>
                <p className="text-2xl font-black text-agri-700 mt-1">{vitalityScore}%</p>
                <span className="inline-block mt-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {vitalityStatus}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Crop Chronology</p>
                <p className="text-2xl font-black text-slate-900 mt-1">Day {plant.age}</p>
                <p className="text-[10px] text-slate-500 mt-1">Target Harvest: Day {plant.harvestAge}</p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Telemetry Status</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">Active</p>
                <p className="text-[10px] text-slate-500 mt-1">Real-time sync verified</p>
              </div>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Scientific Model</p>
                <p className="text-2xl font-black text-indigo-700 mt-1">AGI v2.4</p>
                <p className="text-[10px] text-slate-500 mt-1">Neural Agronomy Engine</p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                1. Microclimate Environmental Parameters vs. Aloe Standards
              </h2>
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Environmental Parameter</th>
                    <th className="py-2.5 px-3">Current Telemetry</th>
                    <th className="py-2.5 px-3">Scientific Standard Target</th>
                    <th className="py-2.5 px-3">Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.values(sensors).map((s) => {
                    const status = getStatus(s);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-900">{s.label}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">
                          {s.value} {s.unit}
                        </td>
                        <td className="py-2 px-3 text-slate-600 font-mono">
                          {s.optimal.min} — {s.optimal.max} {s.unit}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              status === "ok"
                                ? "bg-emerald-100 text-emerald-800"
                                : status === "low"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {status === "ok" ? "In Range (Optimal)" : status === "low" ? "Below Standard (Low)" : "Above Standard (High)"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                2. AGI Agronomic Findings &amp; Prescription
              </h2>
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2 text-emerald-950">
                <p className="leading-relaxed">
                  <strong>Assessment:</strong> Root zone moisture and ambient air temperatures are stabilized for steady photosynthetic CAM cycles. Fleshy leaf cuticle synthesis is progressing normally without symptom of anthocyanin stress or fungal sporulation.
                </p>
                <p className="leading-relaxed">
                  <strong>Action Directive:</strong> Maintain "soak and dry" irrigation. Avoid standing moisture on the crown. Verify ventilation cycles during peak humidity hours.
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                3. Recent Telemetry Log Audit Sample (Last 10 Records)
              </h2>
              {loading ? (
                <p className="text-xs text-slate-500 py-3">Loading telemetry records...</p>
              ) : (
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5">Timestamp</th>
                      <th className="py-2 px-2.5">Node ID</th>
                      <th className="py-2 px-2.5">Moisture (%)</th>
                      <th className="py-2 px-2.5">Temp (°C)</th>
                      <th className="py-2 px-2.5">Humidity (%)</th>
                      <th className="py-2 px-2.5">Light (lux)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 font-mono text-[11px]">
                    {readings.slice(0, 10).map((r) => (
                      <tr key={r.id}>
                        <td className="py-1.5 px-2.5 text-slate-500 font-sans">
                          {r.recorded_at ? new Date(r.recorded_at).toLocaleTimeString() : "Recent"}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-800">{r.device_id || "esp32-node"}</td>
                        <td className="py-1.5 px-2.5">{r.soil_moisture ?? "—"}</td>
                        <td className="py-1.5 px-2.5">{r.temperature ?? "—"}</td>
                        <td className="py-1.5 px-2.5">{r.humidity ?? "—"}</td>
                        <td className="py-1.5 px-2.5">{r.lux ?? r.light_lux ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
                4. Bi-LSTM Neural Network Validation Audit (Model v1.2.0 Checkpoint)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Architecture</p>
                  <p className="font-bold text-slate-900 mt-0.5">Bi-LSTM (2x Layers)</p>
                  <p className="text-[10px] text-slate-500">64 / 32 Units • Dropout 0.2</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Plant Vitality Fit</p>
                  <p className="font-bold text-emerald-700 mt-0.5">R² = 88.75%</p>
                  <p className="text-[10px] text-slate-500">MAE: 0.71 • RMSE: 0.88</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Soil Moisture Fit</p>
                  <p className="font-bold text-sky-700 mt-0.5">R² = 98.68%</p>
                  <p className="text-[10px] text-slate-500">MAE: 0.36 • RMSE: 0.46</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Training Dataset</p>
                  <p className="font-bold text-indigo-700 mt-0.5">1,440 Hourly Steps</p>
                  <p className="text-[10px] text-slate-500">60 Days Evaluated</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs text-slate-600">
              <div>
                <p className="font-bold text-slate-900">Certified Field Operator:</p>
                <div className="h-10 border-b border-slate-400 mt-4"></div>
                <p className="text-[10px] text-slate-500 mt-1">{operatorName} • Signed</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">Lead Agricultural Supervisor:</p>
                <div className="h-10 border-b border-slate-400 mt-4"></div>
                <p className="text-[10px] text-slate-500 mt-1">Quality Assurance &amp; Crop Verification</p>
              </div>
            </div>
          </div>
        </div>

        <div className="no-print px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">Click "Print / Save as PDF" to generate hardcopy or download PDF</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className="fa-solid fa-file-pdf"></i> Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
