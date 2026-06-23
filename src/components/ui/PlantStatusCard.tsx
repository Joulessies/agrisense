"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { getStatus } from "@/lib/utils";

export function PlantStatusCard() {
  const { sensors } = useStore();
  const out = Object.values(sensors).filter((s) => getStatus(s) !== "ok");

  let label, reason, iconColor, iconBg, icon, vitality, stress, stressColor;

  if (out.length === 0) {
    label = "Healthy";
    reason = "All readings within optimal range";
    iconColor = "text-agri-700";
    iconBg = "bg-agri-100";
    icon = "fa-heart";
    vitality = "92%";
    stress = "Low";
    stressColor = "text-agri-600";
  } else if (out.length === 1) {
    label = "Warning";
    reason = `${out[0].label} out of range`;
    iconColor = "text-amber-700";
    iconBg = "bg-amber-100";
    icon = "fa-triangle-exclamation";
    vitality = "72%";
    stress = "Medium";
    stressColor = "text-amber-600";
  } else {
    label = "Critical";
    reason = `${out.length} sensors out of range`;
    iconColor = "text-rose-700";
    iconBg = "bg-rose-100";
    icon = "fa-circle-exclamation";
    vitality = "55%";
    stress = "High";
    stressColor = "text-rose-600";
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-800">Plant Status</p>
        <i className="fa-solid fa-heart-pulse text-slate-300"></i>
      </div>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center`}>
          <i className={`fa-solid ${icon} ${iconColor} text-lg`}></i>
        </div>
        <div>
          <p className={`text-lg font-semibold ${iconColor}`}>
            {label}
            <i
              className="fa-solid fa-info-circle ml-2 cursor-pointer text-slate-400 text-sm align-middle hover:text-slate-600 transition-colors"
              title="AI explanation: Placeholder for model insights"
            ></i>
          </p>
          <p className="text-xs text-slate-500">{reason}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Vitality</p>
          <p className="text-sm font-semibold text-slate-700">{vitality}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Stress</p>
          <p className={`text-sm font-semibold ${stressColor}`}>{stress}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 uppercase">Growth</p>
          <p className="text-sm font-semibold text-slate-700">{out.length > 1 ? "Slowed" : "Stable"}</p>
        </div>
      </div>
    </div>
  );
}
