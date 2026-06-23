"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Radar, Bar } from "react-chartjs-2";
import { StatCard } from "@/components/ui/StatCard";
import { useGeminiInsights } from "@/hooks/useGeminiInsights";

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

const INSIGHT_ICONS: Record<string, string> = {
  ok: "fa-circle-check",
  tip: "fa-lightbulb",
  warning: "fa-triangle-exclamation",
};
const INSIGHT_COLORS: Record<string, { bg: string; icon: string; title: string; body: string }> = {
  ok: { bg: "bg-agri-50 border-agri-100", icon: "text-agri-600", title: "text-agri-900", body: "text-agri-700" },
  tip: { bg: "bg-amber-50 border-amber-100", icon: "text-amber-500", title: "text-slate-800", body: "text-slate-600" },
  warning: { bg: "bg-rose-50 border-rose-100", icon: "text-rose-500", title: "text-slate-800", body: "text-slate-600" },
};

export function AnalyticsView() {
  const { analyticsRange, sensors } = useStore();
  const { insights, isLoading, error, refresh } = useGeminiInsights();

  const handleRefresh = () => {
    const sensorPayload = Object.fromEntries(
      Object.values(sensors).map((s) => [
        s.label,
        { value: s.value, unit: s.unit, optimal: s.optimal },
      ])
    );
    refresh(sensorPayload);
  };

  const radarData = {
    labels: ["Soil Moisture", "Temperature", "Humidity", "Light Intensity", "Air Quality", "Nutrients"],
    datasets: [
      {
        label: "Current",
        data: [85, 90, 75, 80, 95, 70],
        backgroundColor: "rgba(52, 150, 88, 0.2)",
        borderColor: "rgba(52, 150, 88, 1)",
        borderWidth: 2,
      },
    ],
  };

  const radarOptions = {
    scales: { r: { angleLines: { display: false }, suggestedMin: 0, suggestedMax: 100 } },
    plugins: { legend: { display: false } },
    maintainAspectRatio: false,
  };

  const barData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      { label: "Soil Moisture", data: [45, 42, 40, 38, 35, 48, 45], backgroundColor: "#349658" },
      { label: "Temperature", data: [26, 27, 28, 29, 28, 27, 26], backgroundColor: "#fbbf24" },
      { label: "Humidity", data: [60, 62, 58, 55, 65, 70, 68], backgroundColor: "#38bdf8" },
    ],
  };

  const barOptions = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { border: { display: false } },
    },
    maintainAspectRatio: false,
  };

  return (
    <section className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Analytics</h2>
          <p className="text-sm text-slate-500">Insights and trends across your crop&apos;s vital signs.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={analyticsRange}
            onChange={(e) => useStore.setState({ analyticsRange: e.target.value })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-agri-500/30"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="season">This season</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">Health Factor Analysis</p>
              <p className="text-xs text-slate-500">Composite score across environmental factors</p>
            </div>
            <i className="fa-solid fa-bullseye text-slate-300"></i>
          </div>
          <div className="relative h-72 mt-3">
            <Radar data={radarData} options={radarOptions} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">Weekly Environmental Trends</p>
              <p className="text-xs text-slate-500">Average readings for the selected period</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-agri-500"></span>Soil moisture
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-400"></span>Temperature
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-sky-400"></span>Humidity
              </span>
            </div>
          </div>
          <div className="relative h-72 mt-3">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <StatCard
          title="Crop Health Index"
          value={92}
          unit="/ 100"
          icon="fa-leaf"
          iconColor="text-agri-600"
          iconBg="bg-agri-50"
          trendIcon="fa-arrow-trend-up"
          trendText="+4% from last week"
          trendColor="text-agri-600"
        />
        <StatCard
          title="Water Usage"
          value="14.2"
          unit="kL"
          icon="fa-droplet"
          iconColor="text-sky-500"
          iconBg="bg-sky-50"
          trendIcon="fa-arrow-trend-down"
          trendText="-2% from last week"
          trendColor="text-emerald-600"
        />
        <StatCard
          title="Energy Consumption"
          value={342}
          unit="kWh"
          icon="fa-bolt"
          iconColor="text-amber-500"
          iconBg="bg-amber-50"
          trendIcon="fa-arrow-trend-up"
          trendText="+12% from last week"
          trendColor="text-rose-600"
        />
        <StatCard
          title="Anomalies Detected"
          value={3}
          icon="fa-triangle-exclamation"
          iconColor="text-rose-500"
          iconBg="bg-rose-50"
          trendIcon="fa-minus"
          trendText="No change from last week"
          trendColor="text-slate-500"
        />
      </div>

      {/* ── Gemini AI Insights ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-agri-600"></i> AI Insights
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Powered by <strong>Google Gemini</strong> — analyses your live sensor readings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="shrink-0 text-sm px-4 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white font-medium flex items-center gap-2 transition"
          >
            <i className={`fa-solid fa-rotate ${isLoading ? "animate-spin" : ""}`}></i>
            {isLoading ? "Analysing…" : "Refresh analysis"}
          </button>
        </div>

        <div className="p-6 pt-4 space-y-3">
          {/* Error state */}
          {error && !isLoading && (
            <div className="flex items-start gap-3 bg-rose-50 rounded-lg p-4 border border-rose-100">
              <i className="fa-solid fa-circle-exclamation text-rose-500 mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-slate-800">Could not load insights</p>
                <p className="text-sm text-slate-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <>
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-lg p-4 border border-slate-100 animate-pulse">
                  <div className="w-5 h-5 rounded-full bg-slate-200 mt-0.5 shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Empty / prompt state */}
          {!isLoading && !error && insights.length === 0 && (
            <div className="text-center py-6">
              <i className="fa-solid fa-wand-magic-sparkles text-slate-200 text-3xl mb-3"></i>
              <p className="text-sm text-slate-500">
                Click <strong>Refresh analysis</strong> to generate AI insights from your current sensor data.
              </p>
            </div>
          )}

          {/* Results */}
          {!isLoading && insights.map((insight, i) => {
            const colors = INSIGHT_COLORS[insight.type] ?? INSIGHT_COLORS.tip;
            return (
              <li key={i} className={`flex items-start gap-3 rounded-lg p-4 border list-none ${colors.bg}`}>
                <i className={`fa-solid ${INSIGHT_ICONS[insight.type] ?? "fa-lightbulb"} ${colors.icon} mt-0.5`}></i>
                <div>
                  <p className={`text-sm font-semibold ${colors.title}`}>{insight.title}</p>
                  <p className={`text-sm mt-1 ${colors.body}`}>{insight.body}</p>
                </div>
              </li>
            );
          })}
        </div>
      </div>
    </section>
  );
}
