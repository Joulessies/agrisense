"use client";

import React from "react";
import { useStore } from "@/store/useStore";

export function SensorsView() {
  const { nodes, role, addActivity } = useStore();

  const totalNodes = nodes.length;
  const onlineCount = nodes.filter((n) => n.online).length;
  const offlineCount = totalNodes - onlineCount;

  const handleAction = (actionType: string, nodeId: string) => {
    addActivity(`Requested ${actionType} for node ${nodeId}`, "info");
  };

  return (
    <section className="p-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <p className="text-xs text-slate-500">Total nodes</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">{totalNodes}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <p className="text-xs text-slate-500">Online</p>
          <p className="text-2xl font-semibold text-agri-600 mt-1">{onlineCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-card p-5">
          <p className="text-xs text-slate-500">Offline</p>
          <p className="text-2xl font-semibold text-rose-600 mt-1">{offlineCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Sensor nodes</p>
            <p className="text-xs text-slate-500 mt-0.5">All connected devices across your zones.</p>
          </div>
          {role === "admin" && (
            <button className="text-xs bg-agri-600 hover:bg-agri-700 text-white font-medium px-3 py-1.5 rounded-lg transition">
              <i className="fa-solid fa-plus mr-1"></i> Add node
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-semibold">Node ID</th>
                <th className="px-5 py-2 font-semibold">Zone</th>
                <th className="px-5 py-2 font-semibold">Type</th>
                {/* 
                <th className="px-5 py-2 font-semibold">Battery</th>
                <th className="px-5 py-2 font-semibold">Signal</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                */}
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => {
                const batteryColor =
                  n.battery > 50 ? "text-agri-600" : n.battery > 25 ? "text-amber-600" : "text-rose-600";
                const signalColor =
                  n.signal > 60 ? "text-agri-600" : n.signal > 30 ? "text-amber-600" : "text-rose-600";

                return (
                  <tr key={n.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3 font-medium text-slate-800">{n.id}</td>
                    <td className="px-5 py-3 text-slate-600">{n.zone}</td>
                    <td className="px-5 py-3 text-slate-600">{n.type}</td>
                    {/*
                    <td className="px-5 py-3">
                      <span className={`${batteryColor} font-semibold`}>{n.battery}%</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`${signalColor} font-semibold`}>{n.signal}%</span>
                    </td>
                    <td className="px-5 py-3">
                      {n.online ? (
                        <span className="text-[11px] font-semibold text-agri-700 bg-agri-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle text-[6px]"></i>Online
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="fa-solid fa-circle text-[6px]"></i>Offline
                        </span>
                      )}
                    </td>
                    */}
                    <td className="px-5 py-3 text-right">
                      {n.online ? (
                        role === "admin" && (
                          <button
                            onClick={() => handleAction("restart", n.id)}
                            className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 transition"
                          >
                            Restart
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleAction("reconnect", n.id)}
                          className="text-xs text-agri-700 hover:text-agri-800 font-medium px-2 py-1 rounded border border-agri-200 bg-agri-50 hover:bg-agri-100 transition"
                        >
                          Reconnect
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
