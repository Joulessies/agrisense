"use client";

import React from "react";
import { SensorData } from "@/store/useStore";
import { clamp, formatNumber, formatSensorValue, getStatus, getStatusBadge } from "@/lib/utils";

export function SensorCard({ sensor }: { sensor: SensorData }) {
  const badge = getStatusBadge(sensor);
  const status = getStatus(sensor);
  const pct = clamp(((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100, 2, 100);

  let barClass = sensor.barColor;
  if (status === "low") barClass = "bg-amber-400";
  if (status === "high") barClass = "bg-rose-400";

  const { num, unit } = formatSensorValue(sensor);
  const optMin = formatNumber(sensor.optimal.min, sensor.decimals);
  const optMax = formatNumber(sensor.optimal.max, sensor.decimals);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${sensor.iconBg} flex items-center justify-center`}>
          <i className={`fa-solid ${sensor.icon} ${sensor.iconColor}`}></i>
        </div>
        <span className={`${badge.bg} ${badge.text} text-[11px] font-semibold px-2 py-0.5 rounded-full`}>
          <i className={`fa-solid ${badge.icon} mr-1`}></i>{badge.label}
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-500 uppercase tracking-wide">{sensor.label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900 sensor-value">
        {num}<span className="text-lg text-slate-400 font-medium">{unit}</span>
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Optimal: {optMin}–{optMax}{sensor.unit === "lux" ? " lux" : sensor.unit}
      </p>
      <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden sensor-bar">
        <div className={`h-full ${barClass}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}
