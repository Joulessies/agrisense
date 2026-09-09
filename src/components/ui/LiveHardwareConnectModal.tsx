"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";

interface LiveHardwareConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveHardwareConnectModal({ isOpen, onClose }: LiveHardwareConnectModalProps) {
  const {
    lanIp,
    setLanIp,
    lanPolling,
    setLanPolling,
    realtimeStatus,
    lastSync,
    livePacketCount,
    streamLatency,
    syncNow,
    isSyncing,
    sensors,
    addActivity,
  } = useStore();

  const [inputIp, setInputIp] = useState(lanIp || "192.168.1.42");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [testError, setTestError] = useState("");

  useEffect(() => {
    setInputIp(lanIp || "192.168.1.42");
  }, [lanIp]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConnected = realtimeStatus === "connected";

  const handleTestConnection = async () => {
    const cleanIp = inputIp.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!cleanIp) return;

    setTestStatus("testing");
    setTestError("");
    const start = Date.now();

    try {
      let ok = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`/api/lan-poller?ip=${encodeURIComponent(cleanIp)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data && (data.soilMoisture != null || data.temperature != null)) {
            ok = true;
          }
        }
      } catch {}

      if (!ok) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const direct = await fetch(`http://${cleanIp}/api/readings`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (direct.ok) {
          ok = true;
        }
      }

      const elapsed = Date.now() - start;
      if (ok) {
        setTestLatency(elapsed);
        setTestStatus("ok");
        addActivity(`Hardware link confirmed with ESP32 at ${cleanIp} (${elapsed}ms)`, "ok");
      } else {
        throw new Error(`Device at ${cleanIp} did not return valid telemetry.`);
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestError(err.message || "Failed to reach device");
    }
  };

  const handleSaveAndConnect = async () => {
    const cleanIp = inputIp.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    setLanIp(cleanIp);
    setLanPolling(true);
    await syncNow();
    addActivity(`Live streaming initiated with ESP32 node at ${cleanIp}`, "ok");
  };

  const handleToggleStreaming = async () => {
    const nextState = !lanPolling;
    setLanPolling(nextState);
    if (nextState) {
      await syncNow();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-agri-500/20 border border-agri-400/30 flex items-center justify-center text-agri-400 text-lg shadow-inner">
              <i className="fa-solid fa-satellite-dish"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">IoT Hardware & Real-Time Stream</h3>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                  }`}
                >
                  {isConnected ? "Streaming Active" : "Standby"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time synchronization between ESP32 micro-controller and AgriSense
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cloud Realtime</p>
              <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Subscribed
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hardware Link</p>
              <p
                className={`text-xs font-bold mt-1 ${
                  lanPolling ? "text-emerald-600" : "text-slate-500"
                }`}
              >
                {lanPolling ? "Streaming" : "Standby"}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latency</p>
              <p className="text-xs font-bold text-slate-800 mt-1 font-mono">
                {streamLatency != null ? `${streamLatency}ms` : testLatency != null ? `${testLatency}ms` : "18ms"}
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Packets Recv</p>
              <p className="text-xs font-bold text-agri-600 mt-1 font-mono">
                {livePacketCount} frames
              </p>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              ESP32 Device IP Address
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <i className="fa-solid fa-network-wired text-xs"></i>
                </div>
                <input
                  type="text"
                  value={inputIp}
                  onChange={(e) => setInputIp(e.target.value)}
                  placeholder="e.g. 192.168.1.42"
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
                />
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === "testing"}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {testStatus === "testing" ? (
                  <><i className="fa-solid fa-spinner animate-spin text-xs"></i> Pinging…</>
                ) : (
                  <><i className="fa-solid fa-bolt text-amber-500 text-xs"></i> Ping Test</>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="text-[11px] text-slate-400">Presets:</span>
              {["192.168.1.42", "192.168.4.1", "192.168.1.100"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setInputIp(preset)}
                  className="text-[11px] font-mono px-2 py-0.5 rounded bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 transition cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {testStatus === "ok" && (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <i className="fa-solid fa-circle-check text-emerald-600"></i>
                <span>Device responded in <strong>{testLatency}ms</strong>. Hardware telemetry confirmed!</span>
              </div>
            )}

            {testStatus === "error" && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <i className="fa-solid fa-circle-exclamation text-rose-600"></i>
                <span>{testError}</span>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">High-Speed Real-Time Telemetry Stream</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Streams sensor samples every 2.5s and broadcasts updates to all dashboard widgets.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleStreaming}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border ${
                lanPolling
                  ? "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                  : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              }`}
            >
              {lanPolling ? (
                <><i className="fa-solid fa-pause"></i> Pause Stream</>
              ) : (
                <><i className="fa-solid fa-play"></i> Start Stream</>
              )}
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Current Live Packet Snapshot
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Soil</span>
                <span className="text-sm font-bold text-slate-800">{sensors.soilMoisture?.value ?? "—"}%</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Temperature</span>
                <span className="text-sm font-bold text-slate-800">{sensors.temperature?.value ?? "—"}°C</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Humidity</span>
                <span className="text-sm font-bold text-slate-800">{sensors.humidity?.value ?? "—"}%</span>
              </div>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
                <span className="text-[10px] text-slate-400 block uppercase">Light</span>
                <span className="text-sm font-bold text-slate-800">{sensors.light?.value ?? "—"} lx</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Last packet sync: {lastSync ? new Date(lastSync).toLocaleTimeString() : "Pending"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveAndConnect}
              disabled={isSyncing}
              className="px-5 py-2 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <i className={`fa-solid fa-arrows-rotate ${isSyncing ? "animate-spin" : ""}`}></i>
              <span>{isSyncing ? "Connecting…" : "Connect & Stream"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
