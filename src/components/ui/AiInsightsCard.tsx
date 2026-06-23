"use client";

import React from "react";

export function AiInsightsCard() {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 shadow-sm p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-0"></div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-sparkles text-indigo-500"></i>
            AI Insights
          </h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Based on recent soil moisture drops and high temperatures, consider scheduling an irrigation cycle in the next 12 hours to maintain optimal aloe vera growth.
          </p>
          <p className="text-xs text-indigo-600 font-medium cursor-pointer hover:underline">
            View detailed analysis <i className="fa-solid fa-arrow-right ml-1"></i>
          </p>
        </div>
      </div>
    </div>
  );
}
