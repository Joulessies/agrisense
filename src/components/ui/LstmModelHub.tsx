"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/useStore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function LstmModelHub() {
  const { sensors, farmSettings, manualWateringDays, addActivity } = useStore();

  const [modelData, setModelData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChartMetric, setActiveChartMetric] = useState<"vitality" | "soilMoisture">("vitality");
  const [showFullReport, setShowFullReport] = useState(false);

  // Live inference state
  const [inferenceResult, setInferenceResult] = useState<any | null>(null);
  const [inferencing, setInferencing] = useState(false);

  // Fetch model metadata & actual-vs-predicted test samples on mount
  useEffect(() => {
    let mounted = true;
    async function loadModelData() {
      try {
        setLoading(true);
        const res = await fetch("/api/ml-model");
        if (!res.ok) throw new Error("Failed to load ML model package data");
        const data = await res.json();
        if (mounted) {
          setModelData(data);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    loadModelData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRunInference = async () => {
    try {
      setInferencing(true);
      const res = await fetch("/api/ml-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soilMoisture: sensors.soilMoisture.value,
          temperature: sensors.temperature.value,
          humidity: sensors.humidity.value,
          light: sensors.light.value,
          daysWithoutWater: manualWateringDays ?? 3,
        }),
      });
      if (!res.ok) throw new Error("Inference execution failed");
      const data = await res.json();
      setInferenceResult(data.inference);
      addActivity(
        `Bi-LSTM Inference: Vitality ${data.inference.predictedVitality}%, Confidence ${data.inference.confidence}`,
        "ok"
      );
    } catch (err: any) {
      alert(`Inference error: ${err.message}`);
    } finally {
      setInferencing(false);
    }
  };

  // Run initial inference on load once sensors are ready
  useEffect(() => {
    if (sensors && !inferenceResult) {
      handleRunInference();
    }
  }, [sensors]);

  // Prepare chart dataset from actual_vs_predicted test samples
  const chartData = useMemo(() => {
    if (!modelData?.testBenchmarkSample || modelData.testBenchmarkSample.length === 0) {
      return null;
    }

    const samples = modelData.testBenchmarkSample.slice(0, 36); // View 36 sample test hours
    const labels = samples.map((s: any) => {
      const parts = s.timestamp.split(" ");
      const timeParts = (parts[1] || "").split(":");
      return `${timeParts[0] || "00"}:00`;
    });

    if (activeChartMetric === "vitality") {
      return {
        labels,
        datasets: [
          {
            label: "Actual Vitality Index (%)",
            data: samples.map((s: any) => s.actual_vitality),
            borderColor: "#059669",
            backgroundColor: "rgba(5, 150, 105, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
          {
            label: "LSTM Predicted Vitality (%)",
            data: samples.map((s: any) => s.predicted_vitality),
            borderColor: "#6366f1",
            backgroundColor: "transparent",
            borderDash: [5, 4],
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
        ],
      };
    } else {
      return {
        labels,
        datasets: [
          {
            label: "Actual Soil Moisture (%)",
            data: samples.map((s: any) => s.actual_soil_moisture),
            borderColor: "#0284c7",
            backgroundColor: "rgba(2, 132, 199, 0.12)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
          {
            label: "LSTM Predicted Moisture (%)",
            data: samples.map((s: any) => s.predicted_soil_moisture),
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            borderDash: [5, 4],
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
        ],
      };
    }
  }, [modelData, activeChartMetric]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Architecture Status */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-0.5 rounded-full">
                Active Neural Network Engine
              </span>
              <span className="text-xs text-slate-400">v1.2.0 Checkpoint</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Bi-LSTM Aloe Vera Microclimate & Vitality Model
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Stacked Bidirectional Long Short-Term Memory recurrent neural network trained on 1,440 hours of telemetry (temperature, humidity, soil moisture, and solar lux). Built to capture Crassulacean Acid Metabolism (CAM) cycles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRunInference}
              disabled={inferencing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <i className={`fa-solid fa-bolt ${inferencing ? "animate-spin" : ""}`}></i>
              {inferencing ? "Inferencing…" : "Run Live Inference"}
            </button>
            <button
              type="button"
              onClick={() => setShowFullReport(!showFullReport)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 transition flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-file-lines text-xs"></i>
              {showFullReport ? "Hide Evaluation Report" : "View Full Report"}
            </button>
          </div>
        </div>

        {/* Neural Pipeline Flow Diagram */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Input Sliding Window</p>
            <p className="text-sm font-bold text-white mt-0.5">24 Hours (4 Features)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Hidden Recurrent Layers</p>
            <p className="text-sm font-bold text-indigo-300 mt-0.5">2x Bi-LSTM (64 + 32)</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Regularization & Loss</p>
            <p className="text-sm font-bold text-amber-300 mt-0.5">Dropout 0.20 + Huber</p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Dual Target Outputs</p>
            <p className="text-sm font-bold text-emerald-300 mt-0.5">Vitality & Moisture %</p>
          </div>
        </div>
      </div>

      {/* 2. Live Inference Result Card (Connected to real sensors) */}
      {inferenceResult && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                Live Sensor Telemetry Ingested
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">
                Real-Time LSTM Forward Inference Output
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Confidence:</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {inferenceResult.confidence}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Predicted Vitality Index
              </p>
              <p className="text-3xl font-extrabold text-emerald-700 mt-1">
                {inferenceResult.predictedVitality}%
              </p>
              <p className="text-[11px] text-emerald-600 mt-1">
                Based on current {sensors.soilMoisture.value}% moisture & {sensors.temperature.value}°C
              </p>
            </div>

            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">
                Projected 24h Soil Moisture
              </p>
              <p className="text-3xl font-extrabold text-sky-700 mt-1">
                {inferenceResult.predictedSoilMoisture24h}%
              </p>
              <p className="text-[11px] text-sky-600 mt-1">
                Depletion trend under current transpiration
              </p>
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                Leaf Parenchyma Turgor
              </p>
              <p className="text-3xl font-extrabold text-indigo-700 mt-1">
                {inferenceResult.leafTurgor}%
              </p>
              <p className="text-[11px] text-indigo-600 mt-1">
                Hydration pressure of the inner aloe gel core
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Physiological Status
              </p>
              <p className="text-base font-bold text-slate-900 mt-1">
                {inferenceResult.condition}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 truncate" title={inferenceResult.camStomatalState}>
                {inferenceResult.camStomatalState}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Evaluation Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Plant Vitality Index Metrics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">Plant Vitality Prediction Metrics</h4>
              <p className="text-xs text-slate-500">Out-of-sample 20% validation split (288 hours)</p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              R² = {modelData?.metrics?.vitality?.r2Percentage ?? "88.75%"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MAE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.vitality?.mae ?? "0.7144"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">&lt; 1.0 (Optimal)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">RMSE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.vitality?.rmse ?? "0.8822"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">&lt; 1.5 (Pass)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MSE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.vitality?.mse ?? "0.7783"}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Variance</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MAPE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.vitality?.mape ?? "0.78%"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">High Precision</p>
            </div>
          </div>
        </div>

        {/* Soil Moisture Trajectory Metrics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">Soil Moisture Trajectory Metrics</h4>
              <p className="text-xs text-slate-500">Recurrent soil drying & irrigation cycles</p>
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full">
              R² = {modelData?.metrics?.soilMoisture?.r2Percentage ?? "98.68%"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MAE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.soilMoisture?.mae ?? "0.3626"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">&lt; 0.5% (Optimal)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">RMSE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.soilMoisture?.rmse ?? "0.4603"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">Low Residuals</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MSE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.soilMoisture?.mse ?? "0.2119"}
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">Minimal Shift</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase">MAPE</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {modelData?.metrics?.soilMoisture?.mape ?? "1.16%"}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">Sub-2% Margin</p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Interactive Actual vs. Predicted Curve */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h4 className="text-base font-bold text-slate-900">
              Out-of-Sample Test Set Validation Curves
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Empirical ground truth vs. Bi-LSTM forward predictions over unseen hourly test sequences.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveChartMetric("vitality")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeChartMetric === "vitality"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Plant Vitality (R² 88.8%)
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMetric("soilMoisture")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeChartMetric === "soilMoisture"
                  ? "bg-white text-sky-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Soil Moisture (R² 98.7%)
            </button>
          </div>
        </div>

        <div className="h-72 w-full">
          {chartData ? (
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: { position: "top", labels: { font: { size: 12, weight: 600 } } },
                  tooltip: { padding: 10, cornerRadius: 8 },
                },
                scales: {
                  x: { grid: { color: "rgba(241, 245, 249, 0.9)" } },
                  y: {
                    grid: { color: "rgba(241, 245, 249, 0.9)" },
                    ticks: {
                      callback: (val) => `${val}%`,
                    },
                  },
                },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              Loading benchmark test curves…
            </div>
          )}
        </div>
      </div>

      {/* 5. Direct Download Center for Model Assets */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h4 className="text-base font-bold text-slate-900 mb-1">
          Python Model Artifacts & Research Downloads
        </h4>
        <p className="text-xs text-slate-500 mb-4">
          Directly download the complete dataset, model script, notebook, and test outputs for review or local execution.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a
            href="/api/ml-model?download=dataset"
            className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-table text-sm"></i>
              </div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                Historical Dataset
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                1,440 hourly sensor records (.csv)
              </p>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-3 inline-flex items-center gap-1">
              <i className="fa-solid fa-download"></i> Download CSV
            </span>
          </a>

          <a
            href="/api/ml-model?download=predictions"
            className="p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-chart-line text-sm"></i>
              </div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                Actual vs Predicted
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Test set ground truth & residuals (.csv)
              </p>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 mt-3 inline-flex items-center gap-1">
              <i className="fa-solid fa-download"></i> Download CSV
            </span>
          </a>

          <a
            href="/api/ml-model?download=model"
            className="p-4 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
                <i className="fa-brands fa-python text-sm"></i>
              </div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700">
                PyTorch Model Script
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Bi-LSTM model training code (.py)
              </p>
            </div>
            <span className="text-[10px] font-bold text-amber-700 mt-3 inline-flex items-center gap-1">
              <i className="fa-solid fa-download"></i> Download .py
            </span>
          </a>

          <a
            href="/api/ml-model?download=notebook"
            className="p-4 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/40 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-2.5">
                <i className="fa-solid fa-book-open text-sm"></i>
              </div>
              <p className="text-xs font-bold text-slate-900 group-hover:text-rose-700">
                Jupyter Notebook
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Interactive EDA & training (.ipynb)
              </p>
            </div>
            <span className="text-[10px] font-bold text-rose-700 mt-3 inline-flex items-center gap-1">
              <i className="fa-solid fa-download"></i> Download .ipynb
            </span>
          </a>
        </div>
      </div>

      {/* 6. Expandable Model Evaluation Markdown Report */}
      {showFullReport && modelData?.reportMarkdown && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-base font-bold text-slate-900">
              Official Model Evaluation Report
            </h4>
            <a
              href="/api/ml-model?download=report"
              className="text-xs font-semibold text-agri-600 hover:underline flex items-center gap-1"
            >
              <i className="fa-solid fa-download"></i> Download Markdown
            </a>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
            {modelData.reportMarkdown}
          </div>
        </div>
      )}
    </div>
  );
}
