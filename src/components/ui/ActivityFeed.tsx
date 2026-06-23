"use client";

import React from "react";
import { useStore } from "@/store/useStore";

export function ActivityFeed() {
  const { activity } = useStore();

  const handleClear = () => {
    useStore.setState({ activity: [] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Recent activity</p>
        <button
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-slate-700 font-medium transition"
        >
          Clear
        </button>
      </div>
      <ul className="divide-y divide-slate-100 text-sm">
        {activity.length === 0 ? (
          <li className="px-5 py-6 text-center text-sm text-slate-400">No activity yet.</li>
        ) : (
          activity.slice(0, 6).map((item, idx) => {
            const dot =
              item.tone === "warning"
                ? "bg-amber-400"
                : item.tone === "critical"
                ? "bg-rose-400"
                : item.tone === "ok"
                ? "bg-agri-500"
                : "bg-sky-400";
            return (
              <li key={idx} className="px-5 py-3 flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${dot}`}></span>
                <span className="flex-1 text-slate-700">{item.text}</span>
                <span className="text-xs text-slate-400">{item.time}</span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
