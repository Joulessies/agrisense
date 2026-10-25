"use client";

import React, { useState, useEffect, useRef } from "react";
import { SensorData, useStore } from "@/store/useStore";
import { clamp, formatNumber, formatSensorValue, getStatus, getStatusBadge } from "@/lib/utils";

export function SensorCard({ sensor }: { sensor: SensorData }) {
  const { realtimeStatus } = useStore();
  const badge = getStatusBadge(sensor);
  const status = getStatus(sensor);
  const isDisconnected = sensor.value === null || sensor.value === undefined || isNaN(sensor.value);
  const pct = isDisconnected || sensor.value === null ? 0 : clamp(((sensor.value - sensor.min) / (sensor.max - sensor.min)) * 100, 2, 100);

  const [isUpdating, setIsUpdating] = useState(false);
  const prevValue = useRef(sensor.value);

  useEffect(() => {
    if (prevValue.current !== sensor.value) {
      prevValue.current = sensor.value;
      setIsUpdating(true);
      const timer = setTimeout(() => setIsUpdating(false), 800);
      return () => clearTimeout(timer);
    }
  }, [sensor.value]);

  let barClass = sensor.barColor;
  if (isDisconnected) barClass = "bg-slate-200";
  else if (status === "low") barClass = "bg-amber-400";
  else if (status === "high") barClass = "bg-rose-400";

  const { num, unit } = formatSensorValue(sensor);
  const optMin = formatNumber(sensor.optimal.min, sensor.decimals);
  const optMax = formatNumber(sensor.optimal.max, sensor.decimals);

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-300 shadow-card p-5 relative overflow-hidden ${
        isUpdating
          ? "border-emerald-400 ring-2 ring-emerald-400/20 shadow-md scale-[1.01]"
          : "border-slate-200"
      }`}
    >
      {realtimeStatus === "connected" && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Live</span>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg ${sensor.iconBg} flex items-center justify-center`}>
          <i className={`fa-solid ${sensor.icon} ${sensor.iconColor}`}></i>
        </div>
        <span className={`${badge.bg} ${badge.text} text-[11px] font-semibold px-2 py-0.5 rounded-full mr-12`}>
          <i className={`fa-solid ${badge.icon} mr-1`}></i>{badge.label}
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-500 uppercase tracking-wide">{sensor.label}</p>
      <p
        className={`mt-1 text-3xl font-semibold sensor-value transition-colors duration-300 ${
          isDisconnected
            ? "text-slate-400 font-normal tracking-wider"
            : isUpdating
            ? "text-emerald-600 font-bold"
            : "text-slate-900"
        }`}
      >
        {num}{unit && <span className="text-lg text-slate-400 font-medium">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Optimal: {optMin}–{optMax}{sensor.unit === "lux" ? " lux" : sensor.unit}
      </p>
      <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden sensor-bar">
        <div
          className={`h-full ${barClass} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        ></div>
      </div>
    </div>
  );
}
