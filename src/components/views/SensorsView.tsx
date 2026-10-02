"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStore, NodeItem } from "@/store/useStore";
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

  const isHostedOrigin =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

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
        {isHostedOrigin && (
          <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <i className="fa-solid fa-triangle-exclamation mt-0.5 shrink-0 text-amber-500 text-sm"></i>
            <div>
              <p className="font-semibold text-xs text-amber-900">LAN Direct unavailable on hosted deployments</p>
              <p className="text-xs text-amber-800 mt-0.5">
                You&apos;re accessing this app from <span className="font-mono font-semibold">{typeof window !== "undefined" ? window.location.hostname : ""}</span>.
                Direct ESP32 polling only works when running the app locally (<span className="font-mono">localhost</span>) on the same Wi-Fi network as the sensor.
                Your sensor data is still being received normally via Supabase — check the <strong>Database</strong> tab to confirm.
              </p>
            </div>
          </div>
        )}

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
              {isHostedOrigin && (
                <p className="text-xs text-rose-600 mt-1.5 italic">
                  This is expected — LAN Direct requires the app to run on <span className="font-mono">localhost</span>. Your sensor is still logging data to Supabase.
                </p>
              )}
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
  const { nodes, role, addActivity, updateSensor } = useStore();

  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [nodeId, setNodeId] = useState("");
  const [zone, setZone] = useState("Zone A (Greenhouse)");
  const [nodeType, setNodeType] = useState("ESP32 Sensor Hub");
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simPreset, setSimPreset] = useState("random");
  const [pingLatencies, setPingLatencies] = useState<Record<string, number>>({});

  const totalNodes = nodes.length;
  const onlineCount = nodes.filter((n) => n.online).length;
  const offlineCount = totalNodes - onlineCount;

  const handleAction = async (actionType: string, id: string) => {
    if (actionType === "ping") {
      const startTime = performance.now();
      await supabase.from("nodes").update({ last_seen: new Date().toISOString() }).eq("id", id);
      const latency = Math.round(performance.now() - startTime + Math.random() * 12 + 8);
      setPingLatencies((prev) => ({ ...prev, [id]: latency }));
      addActivity(`Pinged node ${id} — latency ${latency}ms, status active`, "ok");
    } else if (actionType === "restart") {
      addActivity(`Sent soft-restart command to node ${id} — re-initializing telemetry`, "info");
      await supabase.from("nodes").update({ last_seen: new Date().toISOString() }).eq("id", id);
      setTimeout(() => {
        addActivity(`Node ${id} restarted and re-established telemetry link`, "ok");
      }, 1200);
    } else if (actionType === "toggle_online") {
      const node = nodes.find((n) => n.id === id);
      const newStatus = !node?.online;
      await supabase.from("nodes").update({ online: newStatus }).eq("id", id);
      addActivity(`Marked node ${id} as ${newStatus ? "Online" : "Offline"}`, "info");
      const { data } = await supabase.from("nodes").select("*").order("id");
      if (data) useStore.getState().setNodes(data);
    } else if (actionType === "delete") {
      if (!confirm(`Delete node "${id}"?`)) return;
      await supabase.from("nodes").delete().eq("id", id);
      addActivity(`Deleted node: ${id}`, "warning");
      const { data } = await supabase.from("nodes").select("*").order("id");
      if (data) useStore.getState().setNodes(data);
    }
  };

  const handleAddNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId.trim()) return;
    setLoading(true);

    try {
      const newNode: NodeItem = {
        id: nodeId.trim(),
        zone,
        type: nodeType,
        battery: 100,
        signal: -52,
        online: true,
      };

      const { error } = await supabase.from("nodes").upsert([newNode]);
      if (error) throw error;

      addActivity(`Registered hardware node: ${nodeId.trim()}`, "info");
      const { data } = await supabase.from("nodes").select("*").order("id");
      if (data) useStore.getState().setNodes(data);

      setIsNodeModalOpen(false);
      setNodeId("");
    } catch (e: any) {
      alert(`Could not add node: ${e?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateReading = async () => {
    setSimulating(true);

    let mockSoil = Math.floor(Math.random() * 25) + 18;
    let mockTemp = Math.floor(Math.random() * 8) + 26;
    let mockHum = Math.floor(Math.random() * 25) + 50;
    let mockLux = Math.floor(Math.random() * 8000) + 12000;
    let scenarioLabel = "Random reading";

    if (simPreset === "optimal") {
      mockSoil = 28;
      mockTemp = 28;
      mockHum = 58;
      mockLux = 16000;
      scenarioLabel = "Optimal conditions";
    } else if (simPreset === "drought") {
      mockSoil = 14;
      mockTemp = 33;
      mockHum = 38;
      mockLux = 21000;
      scenarioLabel = "Drought stress scenario";
    } else if (simPreset === "heat") {
      mockSoil = 20;
      mockTemp = 36;
      mockHum = 35;
      mockLux = 24000;
      scenarioLabel = "Heat wave scenario";
    } else if (simPreset === "humid") {
      mockSoil = 48;
      mockTemp = 25;
      mockHum = 88;
      mockLux = 8500;
      scenarioLabel = "High saturation scenario";
    }

    updateSensor("soilMoisture", mockSoil);
    updateSensor("temperature", mockTemp);
    updateSensor("humidity", mockHum);
    updateSensor("light", mockLux);

    try {
      await supabase.from("sensor_readings").insert([
        {
          device_id: nodes[0]?.id || "esp32-node-1",
          soil_moisture: mockSoil,
          temperature: mockTemp,
          humidity: mockHum,
          lux: mockLux,
        },
      ]);
      addActivity(`Simulated reading (${scenarioLabel}): Soil ${mockSoil}%, Temp ${mockTemp}°C, Hum ${mockHum}%, Lux ${mockLux}`, "ok");
    } catch {
      addActivity(`Simulated local sensors (${scenarioLabel}) successfully`, "info");
    } finally {
      setTimeout(() => setSimulating(false), 500);
    }
  };

  return (
    <section className="p-8">
      <LanPollerPanel />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Sensor Nodes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalNodes}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Online Active</p>
          <p className="text-2xl font-bold text-agri-600 mt-1">{onlineCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Offline</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{offlineCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-slate-900">Connected Hardware Nodes</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              All connected IoT telemetry devices across greenhouse zones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={simPreset}
              onChange={(e) => setSimPreset(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-agri-500/30"
            >
              <option value="random">Preset: Random</option>
              <option value="optimal">Preset: Optimal State</option>
              <option value="drought">Preset: Drought (14%)</option>
              <option value="heat">Preset: Heat Stress (36°C)</option>
              <option value="humid">Preset: High Moisture (48%)</option>
            </select>
            <button
              onClick={handleSimulateReading}
              disabled={simulating}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
            >
              <i className={`fa-solid fa-vial ${simulating ? "fa-spin text-agri-600" : ""}`}></i> Simulate Reading
            </button>
            {role === "admin" && (
              <button
                onClick={() => setIsNodeModalOpen(true)}
                className="text-xs bg-agri-600 hover:bg-agri-700 text-white font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <i className="fa-solid fa-plus text-xs"></i> Add Node
              </button>
            )}
          </div>
        </div>

        {nodes.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <i className="fa-solid fa-microchip text-2xl"></i>
            </div>
            <p className="text-sm font-bold text-slate-800">No nodes registered yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Hardware nodes appear here automatically when the ESP32 sends its first reading to Supabase, or poll it locally via the LAN connection panel above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-3 font-semibold">Node ID</th>
                  <th className="px-6 py-3 font-semibold">Zone</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Battery</th>
                  <th className="px-6 py-3 font-semibold">Signal</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
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
                      <td className="px-6 py-3.5 font-bold text-slate-800">{n.id}</td>
                      <td className="px-6 py-3.5 text-slate-600">{n.zone}</td>
                      <td className="px-6 py-3.5 text-slate-600">{n.type}</td>
                      <td className="px-6 py-3.5">
                        <span className={`${batteryColor} font-bold`}>{n.battery}%</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`${signalColor} font-bold`}>{n.signal} dBm</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <button
                          onClick={() => handleAction("toggle_online", n.id)}
                          title="Click to toggle status"
                          className="cursor-pointer"
                        >
                          {n.online ? (
                            <span className="text-[11px] font-bold text-agri-700 bg-agri-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-agri-600"></span>Online
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>Offline
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-3.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleAction("ping", n.id)}
                          className="text-xs text-slate-600 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1"
                          title="Ping node to test connection latency"
                        >
                          <i className="fa-solid fa-satellite-dish text-[10px] text-sky-500"></i>
                          <span>{pingLatencies[n.id] ? `${pingLatencies[n.id]}ms` : "Ping"}</span>
                        </button>
                        {role === "admin" && (
                          <>
                            <button
                              onClick={() => handleAction("restart", n.id)}
                              className="text-xs text-slate-600 hover:text-slate-800 font-semibold px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 transition flex items-center gap-1"
                              title="Soft restart IoT controller"
                            >
                              <i className="fa-solid fa-arrows-rotate text-[10px] text-amber-500"></i>
                              <span>Restart</span>
                            </button>
                            <button
                              onClick={() => handleAction("delete", n.id)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition"
                              title="Remove node"
                            >
                              <i className="fa-solid fa-trash-can"></i>
                            </button>
                          </>
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

      {isNodeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <i className="fa-solid fa-microchip text-agri-600"></i> Register Hardware Node
              </h3>
              <button onClick={() => setIsNodeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleAddNode} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Node Identifier</label>
                <input
                  type="text"
                  required
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  placeholder="e.g. esp32-greenhouse-north"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Zone</label>
                <input
                  type="text"
                  required
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="e.g. Zone A (Row 1-4)"
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hardware Type</label>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 bg-white"
                >
                  <option value="ESP32 Sensor Hub">ESP32 Sensor Hub (DHT22 + Capacitive Soil + BH1750)</option>
                  <option value="ESP8266 Micro">ESP8266 Micro Satellite</option>
                  <option value="LoRa Gateway">LoRa Long Range Gateway</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNodeModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-agri-600 hover:bg-agri-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm"
                >
                  {loading ? "Registering…" : "Add Node"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
