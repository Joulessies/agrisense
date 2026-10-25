"use client";

import React from "react";
import { useStore } from "@/store/useStore";
import { clamp } from "@/lib/utils";

import { supabase } from "@/lib/supabase";

export function HarvestCard() {
  const { plant, setPlant, addActivity, setCurrentView } = useStore();
  const { age, harvestAge } = plant;
  const ready = age >= harvestAge;
  const progress = harvestAge > 0 ? clamp((age / harvestAge) * 100, 0, 100) : 0;

  const handleHarvest = async () => {
    const newAge = Math.max(0, age - 180);
    const nowIso = new Date().toISOString();
    setPlant({ age: newAge, baseAge: newAge, harvestAge, lastUpdatedDate: nowIso });
    addActivity(`Recorded Aloe vera mature leaf harvest at age ${age} days`, "ok");
    try {
      await supabase.from("plant_info").update({ age: newAge, harvest_age: harvestAge }).eq("id", 1);
    } catch (e: any) {
      console.warn("Failed to persist harvest to plant_info:", e?.message);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5 flex flex-col justify-between">
      <div>
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
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs text-slate-500">Plant age: <strong className="text-slate-700">{age} days</strong></p>
              <span
                className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded-full font-medium"
                title="Awtomatikong magdadagdag ng +1 day pagsapit ng 12:00 AM Midnight"
              >
                +1 day @ 12 AM
              </span>
            </div>
          </div>
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
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Target: {harvestAge}+ days <span className="text-[10px] text-slate-400">• +1 @ 12:00 AM</span>
          </p>
          {ready ? (
            <button
              onClick={handleHarvest}
              className="text-xs font-semibold px-2.5 py-1 bg-agri-600 hover:bg-agri-700 text-white rounded-lg transition shadow-xs"
            >
              Harvest Leaves
            </button>
          ) : (
            <button
              onClick={() => setCurrentView("settings")}
              className="text-xs font-medium text-agri-600 hover:underline"
            >
              Edit Timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

