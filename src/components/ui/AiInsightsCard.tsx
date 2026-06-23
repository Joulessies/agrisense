"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { getStatus } from "@/lib/utils";

export function AiInsightsCard() {
  const { sensors, setCurrentView } = useStore();

  const outOfRange = Object.values(sensors).filter((s) => getStatus(s) !== "ok");
  const allOptimal = outOfRange.length === 0;

  const summaryText = allOptimal
    ? "All sensor readings are within optimal range. Your aloe vera crop is in good condition."
    : `${outOfRange.map((s) => s.label).join(", ")} ${outOfRange.length === 1 ? "is" : "are"} outside optimal range. Review recommendations and take corrective action.`;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-sm p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-0"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-sparkles text-indigo-500"></i>
            AI Insights
          </h3>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              allOptimal ? "bg-agri-100 text-agri-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {allOptimal ? "All clear" : `${outOfRange.length} concern${outOfRange.length > 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{summaryText}</p>
          <button
            onClick={() => setCurrentView("analytics")}
            className="text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
          >
            View detailed AI analysis <i className="fa-solid fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
