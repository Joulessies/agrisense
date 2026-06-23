"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore } from "@/store/useStore";

// ── LAN Poller ────────────────────────────────────────────────────────────────

interface LocalReading {
  device_id?: string;
  soilMoisture?: number;
  temperature?: number;
  humidity?: number;
  lux?: number;
  dht_error?: boolean;
  uptime_ms?: number;
}

function LanPollerPanel() {
  const { updateSensor, addActivity } = useStore();
  const [ip, setIp] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [result, setResult] = useState<LocalReading | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchOnce = async (deviceIp: string): Promise<boolean> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`http://${deviceIp}/api/readings`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LocalReading = await res.json();
      setResult(data);
      setStatus("ok");
      setErrorMsg("");

      // Push into the global sensor store so dashboard updates live
      if (data.soilMoisture != null) updateSensor("soilMoisture", data.soilMoisture);
      if (data.temperature != null) updateSensor("temperature", data.temperature);
      if (data.humidity != null) updateSensor("humidity", data.humidity);
      if (data.lux != null) updateSensor("light", data.lux);

      return true;
    } catch (e: any) {
      clearTimeout(timeoutId);
      const msg: string =
        e?.name === "AbortError"
          ? "Request timed out — is the device on the same network?"
          : e?.message ?? "Unknown error";
      setStatus("error");
      setErrorMsg(msg);
      return false;
    }
  };

  const handleFetch = async () => {
    if (!ip.trim()) return;
    setStatus("loading");
    setResult(null);
    await fetchOnce(ip.trim());
  };

  const handleTogglePolling = () => {
    if (polling) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setPolling(false);
      addActivity("Stopped LAN polling", "info");
    } else {
      if (!ip.trim()) return;
      setPolling(true);
      addActivity(`Started LAN polling for ${ip.trim()}`, "info");
      fetchOnce(ip.trim());
      pollRef.current = setInterval(() => fetchOnce(ip.trim()), 5000);
    }
  };

  const formatUptime = (ms?: number) => {
    if (ms == null) return "—";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <i className="fa-solid fa-wifi text-agri-500"></i> LAN Direct Connection
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Poll the ESP32 over your local network — device must be on the same Wi-Fi.
          </p>
        </div>
        {polling && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-agri-700 bg-agri-50 border border-agri-200 px-2.5 py-1 rounded-full">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-agri-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-2 h-2 rounded-full bg-agri-500"></span>
            </span>
            Polling every 5 s
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">
              Device IP address
            </label>
            <input
              type="text"
              placeholder="192.168.1.42"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Check the Serial Monitor after flashing — IP is printed on boot.
            </p>
          </div>
          <button
            onClick={handleFetch}
            disabled={!ip.trim() || status === "loading"}
            className="px-4 py-2 bg-agri-600 hover:bg-agri-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {status === "loading"
              ? <><i className="fa-solid fa-rotate animate-spin mr-1"></i>Fetching…</>
              : <><i className="fa-solid fa-plug mr-1"></i>Fetch</>}
          </button>
          <button
            onClick={handleTogglePolling}
            disabled={!ip.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition disabled:opacity-50 border ${
              polling
                ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {polling
              ? <><i className="fa-solid fa-stop mr-1"></i>Stop</>
              : <><i className="fa-solid fa-rotate-right mr-1"></i>Auto-poll</>}
          </button>
        </div>

        {/* Error */}
        {status === "error" && (
          <div className="mt-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700">
            <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result */}
        {status === "ok" && result && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Soil Moisture",
                value: result.soilMoisture != null ? `${result.soilMoisture}%` : "—",
                icon: "fa-droplet",
                color: "text-amber-500",
                bg: "bg-amber-50",
              },
              {
                label: "Temperature",
                value: result.temperature != null ? `${result.temperature.toFixed(1)}°C` : "—",
                icon: "fa-temperature-half",
                color: "text-agri-600",
                bg: "bg-agri-50",
              },
              {
                label: "Humidity",
                value: result.humidity != null ? `${result.humidity.toFixed(1)}%` : "—",
                icon: "fa-cloud",
                color: "text-sky-500",
                bg: "bg-sky-50",
              },
              {
                label: "Light",
                value: result.lux != null ? `${Math.round(result.lux).toLocaleString()} lux` : "—",
                icon: "fa-sun",
                color: "text-yellow-500",
                bg: "bg-yellow-50",
              },
            ].map((item) => (
              <div key={item.label} className={`${item.bg} rounded-lg p-3`}>
                <div className="flex items-center gap-2 mb-1">
                  <i className={`fa-solid ${item.icon} ${item.color} text-xs`}></i>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{item.label}</p>
                </div>
                <p className="text-lg font-semibold text-slate-800">{item.value}</p>
              </div>
            ))}

            {/* Footer row */}
            <div className="col-span-2 sm:col-span-4 flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
              <span>
                <i className="fa-solid fa-microchip mr-1"></i>
                {result.device_id ?? "Unknown device"}
              </span>
              <span>
                <i className="fa-solid fa-clock mr-1"></i>
                Uptime: {formatUptime(result.uptime_ms)}
              </span>
              {result.dht_error && (
                <span className="text-amber-500 font-medium">
                  <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                  DHT22 read error
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Nodes table ───────────────────────────────────────────────────────────────

export function SensorsView() {
  const { nodes, role, addActivity } = useStore();

  const totalNodes  = nodes.length;
  const onlineCount = nodes.filter((n) => n.online).length;
  const offlineCount = totalNodes - onlineCount;

  const handleAction = (actionType: string, nodeId: string) => {
    addActivity(`Requested ${actionType} for node ${nodeId}`, "info");
  };

  return (
    <section className="p-8">
      {/* LAN direct-connect panel */}
      <LanPollerPanel />

      {/* Summary cards */}
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

      {/* Nodes table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Sensor nodes</p>
            <p className="text-xs text-slate-500 mt-0.5">
              All connected devices — populated automatically when the ESP32 sends its first reading.
            </p>
          </div>
          {role === "admin" && (
            <button className="text-xs bg-agri-600 hover:bg-agri-700 text-white font-medium px-3 py-1.5 rounded-lg transition">
              <i className="fa-solid fa-plus mr-1"></i> Add node
            </button>
          )}
        </div>

        {nodes.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <i className="fa-solid fa-microchip text-slate-200 text-4xl mb-3"></i>
            <p className="text-sm font-medium text-slate-500">No nodes registered yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Nodes appear here automatically once the ESP32 sends its first reading to Supabase.
              Use the LAN panel above to verify connectivity first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2 font-semibold">Node ID</th>
                  <th className="px-5 py-2 font-semibold">Zone</th>
                  <th className="px-5 py-2 font-semibold">Type</th>
                  <th className="px-5 py-2 font-semibold">Battery</th>
                  <th className="px-5 py-2 font-semibold">Signal</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
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
                      <td className="px-5 py-3">
                        <span className={`${batteryColor} font-semibold`}>{n.battery}%</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`${signalColor} font-semibold`}>{n.signal}</span>
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
        )}
      </div>
    </section>
  );
}
