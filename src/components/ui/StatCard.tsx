import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  trendIcon: string;
  trendText: string;
  trendColor: string;
}

export function StatCard({
  title,
  value,
  unit,
  icon,
  iconColor,
  iconBg,
  trendIcon,
  trendText,
  trendColor,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
      <div className="flex items-center gap-3 mb-1">
        <i className={`fa-solid ${icon} ${iconColor} ${iconBg} p-2 rounded-lg`}></i>
        <p className="text-sm font-medium text-slate-600">{title}</p>
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">
        {value}
        {unit && <span className="text-base text-slate-400 font-medium ml-1">{unit}</span>}
      </p>
      <p className={`text-xs ${trendColor} font-medium mt-2 flex items-center gap-1`}>
        <i className={`fa-solid ${trendIcon}`}></i> {trendText}
      </p>
    </div>
  );
}
