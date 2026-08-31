"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { clamp } from "@/lib/utils";

export function HarvestCard() {
  const { plant } = useStore();
  const { age, harvestAge } = plant;
  const ready = age >= harvestAge;
  const progress = harvestAge > 0 ? clamp((age / harvestAge) * 100, 0, 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">Harvest Readiness</p>
        <i className="fa-solid fa-wheat-awn text-slate-300"></i>
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-full ${
            ready ? "bg-agri-100" : "bg-slate-100"
          } flex items-center justify-center`}
        >
          <i
            className={`fa-solid ${
              ready ? "fa-circle-check text-agri-600" : "fa-hourglass-half text-slate-500"
            } text-lg`}
          ></i>
        </div>
        <div>
          <p className={`text-lg font-semibold ${ready ? "text-agri-700" : "text-slate-700"}`}>
            {ready ? "Ready to Harvest" : "Not Ready"}
          </p>
          <p className="text-xs text-slate-500">Plant age: {age} days</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
          <span>Progress to harvest</span>
          <span className="font-medium text-slate-700">
            {age} / {harvestAge} days
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-agri-500 transition-all duration-500 ease-in-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Optimal harvest at {harvestAge}+ days</p>
      </div>
    </div>
  );
}
