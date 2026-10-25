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
  onClick?: () => void;
  clickable?: boolean;
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
  onClick,
  clickable,
}: StatCardProps) {
  const isClickable = Boolean(clickable || onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-card p-5 transition-all duration-200 ${
        isClickable
          ? "cursor-pointer hover:border-rose-300 hover:shadow-md hover:-translate-y-0.5 relative group"
          : ""
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <i className={`fa-solid ${icon} ${iconColor} ${iconBg} p-2 rounded-lg`}></i>
          <p className="text-sm font-medium text-slate-600">{title}</p>
        </div>
        {isClickable && (
          <span className="text-[10px] text-slate-400 group-hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors">
            <span>View</span>
            <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </span>
        )}
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
