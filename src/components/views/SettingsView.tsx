"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

export function SettingsView() {
  const { role, sensors, addActivity } = useStore();
  const isAdmin = role === "admin";

  const handleUpdate = async (id: string, field: 'optimal_min' | 'optimal_max', value: number) => {
    try {
      const { error } = await supabase
        .from('sensor_settings')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      addActivity(`Updated ${id} ${field} to ${value}`, 'info');
    } catch (err: any) {
      console.error('Failed to update setting', err);
      addActivity(`Failed to update ${id}: ${err.message}`, 'warning');
    }
  };

  return (
    <section className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Sensor Thresholds</p>
          <p className="text-xs text-slate-500 mt-0.5">Configure the optimal operating ranges for your environment.</p>
        </div>
        <div className="px-6 py-2">
          {Object.values(sensors).map((s) => (
            <ThresholdRow key={s.id} s={s} isAdmin={isAdmin} onUpdate={handleUpdate} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ThresholdRow({ s, isAdmin, onUpdate }: { s: any, isAdmin: boolean, onUpdate: (id: string, f: 'optimal_min' | 'optimal_max', v: number) => void }) {
  const [min, setMin] = useState(s.optimal.min);
  const [max, setMax] = useState(s.optimal.max);

  useEffect(() => {
    setMin(s.optimal.min);
    setMax(s.optimal.max);
  }, [s.optimal.min, s.optimal.max]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center py-3 border-b border-slate-100 last:border-0">
      <div className="sm:col-span-3 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
          <i className={`fa-solid ${s.icon} ${s.iconColor} text-xs`}></i>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">{s.label}</p>
          <p className="text-[11px] text-slate-500">{s.unit === "lux" ? "lux" : s.unit}</p>
        </div>
      </div>
      <div className="sm:col-span-4">
        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Optimal min</label>
        <input
          type="number"
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          onBlur={() => { if (min !== s.optimal.min) onUpdate(s.id, 'optimal_min', min); }}
          disabled={!isAdmin}
          className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
      <div className="sm:col-span-4">
        <label className="text-[10px] text-slate-500 uppercase tracking-wide">Optimal max</label>
        <input
          type="number"
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          onBlur={() => { if (max !== s.optimal.max) onUpdate(s.id, 'optimal_max', max); }}
          disabled={!isAdmin}
          className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500"
        />
      </div>
    </div>
  );
}
