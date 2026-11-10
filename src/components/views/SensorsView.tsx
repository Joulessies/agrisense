"use client";

import React, { useState } from "react";
import { useStore } from "@/store/useStore";
import { supabase } from "@/lib/supabase";

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
  const { updateSensor, addActivity, lanIp, setLanIp, lanPolling, setLanPolling } = useStore();
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [result, setResult] = useState<LocalReading | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleIpChange = (newIp: string) => {
    setLanIp(newIp);
  };

  const fetchOnce = async (targetIp?: string): Promise<boolean> => {
    const rawIp = (targetIp || lanIp || "192.168.1.42").trim();
    const cleanIp = rawIp.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    setStatus("loading");

    try {
      let data: LocalReading;

      const proxyRes = await fetch(`/api/lan-poller?ip=${encodeURIComponent(cleanIp)}`, {
        cache: "no-store",
      });

      if (proxyRes.ok) {
        data = await proxyRes.json();
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const directRes = await fetch(`http://${cleanIp}/api/readings`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!directRes.ok) throw new Error(`HTTP ${directRes.status}`);
        data = await directRes.json();
      }

      setResult(data);
      setStatus("ok");
      setErrorMsg("");

      if (data.soilMoisture != null) updateSensor("soilMoisture", data.soilMoisture);
      if (data.temperature != null) updateSensor("temperature", data.temperature);
      if (data.humidity != null) updateSensor("humidity", data.humidity);
      if (data.lux != null) updateSensor("light", data.lux);

      useStore.getState().incrementPacketCount?.();
      useStore.setState({ lastSync: new Date(), realtimeStatus: "connected" });
      await supabase.from("sensor_readings").insert([{
        device_id: data.device_id || "esp32-lan",
        soil_moisture: data.soilMoisture,
        temperature: data.temperature,
        humidity: data.humidity,
        lux: data.lux,
      }]);

      addActivity(`LAN poll successful from ${cleanIp}`, "info");
      return true;
    } catch (e: any) {
      const msg: string =
        e?.name === "AbortError"
          ? `Timeout connecting to ${cleanIp} — check if device is powered on and on the same Wi-Fi.`
          : e?.message ?? "Device unreachable";
      setStatus("error");
      setErrorMsg(msg);
      return false;
    }
  };

  const handleFetch = async () => {
    await fetchOnce();
  };

  const handleTogglePolling = async () => {
    const targetIp = (lanIp || "192.168.1.42").trim();
    const nextPolling = !lanPolling;
    setLanPolling(nextPolling);

    if (nextPolling) {
      addActivity(`Started live real-time stream for ${targetIp}`, "info");
      await useStore.getState().syncNow();
    } else {
      addActivity("Stopped live stream", "info");
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <i className="fa-solid fa-wifi text-agri-600"></i> LAN Direct ESP32 Connection
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Directly poll real-time telemetry from your ESP32 micro-controller over your local Wi-Fi.
          </p>
        </div>
        {lanPolling && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-agri-700 bg-agri-50 border border-agri-200 px-3 py-1 rounded-full shrink-0">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-agri-400 opacity-75 animate-ping"></span>
              <span className="relative inline-flex w-2 h-2 rounded-full bg-agri-500"></span>
            </span>
            Active across all tabs (every 5s)
          </span>
        )}
      </div>

      <div className="pt-4">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          Device IP Address or Hostname
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <i className="fa-solid fa-network-wired text-xs"></i>
            </div>
            <input
              type="text"
              value={lanIp}
              onChange={(e) => handleIpChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetch()}
              placeholder="e.g. 192.168.1.42"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 transition"
            />
          </div>

          <button
            type="button"
            onClick={handleFetch}
            disabled={status === "loading"}
            className="px-5 py-2.5 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {status === "loading" ? (
              <><i className="fa-solid fa-arrows-rotate animate-spin text-xs"></i> Fetching…</>
            ) : (
              <><i className="fa-solid fa-plug text-xs"></i> Fetch Now</>
            )}
          </button>

          <button
            type="button"
            onClick={handleTogglePolling}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition shadow-sm flex items-center justify-center gap-2 border cursor-pointer ${
              lanPolling
                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {lanPolling ? (
              <><i className="fa-solid fa-stop text-xs"></i> Stop Live Stream</>
            ) : (
              <><i className="fa-solid fa-satellite-dish text-xs text-agri-600"></i> Connect & Stream Live</>
            )}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <span className="text-[11px] text-slate-400">Quick presets:</span>
          {["192.168.1.42", "192.168.4.1", "192.168.1.100"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleIpChange(preset)}
              className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
            >
              {preset}
            </button>
          ))}
        </div>

        {status === "error" && (
          <div className="mt-4 flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
            <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-rose-500"></i>
            <div>
              <p className="font-semibold text-xs text-rose-900">Connection Failed</p>
              <p className="text-xs text-rose-700 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {status === "ok" && result && (
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Soil Moisture",
                  value: result.soilMoisture != null ? `${result.soilMoisture}%` : "—",
                  icon: "fa-droplet",
                  color: "text-amber-500",
                  bg: "bg-white",
                },
                {
                  label: "Temperature",
                  value: result.temperature != null ? `${result.temperature.toFixed(1)}°C` : "—",
                  icon: "fa-temperature-half",
                  color: "text-agri-600",
                  bg: "bg-white",
                },
                {
                  label: "Humidity",
                  value: result.humidity != null ? `${result.humidity.toFixed(1)}%` : "—",
                  icon: "fa-cloud",
                  color: "text-sky-500",
                  bg: "bg-white",
                },
                {
                  label: "Light",
                  value: result.lux != null ? `${Math.round(result.lux).toLocaleString()} lux` : "—",
                  icon: "fa-sun",
                  color: "text-yellow-500",
                  bg: "bg-white",
                },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-xl p-3.5 border border-slate-200/80 shadow-xs`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <i className={`fa-solid ${item.icon} ${item.color} text-xs`}></i>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{item.label}</p>
                  </div>
                  <p className="text-xl font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-microchip text-slate-400"></i>
                Device ID: <strong className="text-slate-700">{result.device_id ?? "ESP32-Node"}</strong>
              </span>
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-clock text-slate-400"></i>
                Uptime: <strong className="text-slate-700">{formatUptime(result.uptime_ms)}</strong>
              </span>
              {result.dht_error && (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  DHT22 sensor read error
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SensorsView() {
  return (
    <section className="p-8">
      <LanPollerPanel />
    </section>
  );
}
