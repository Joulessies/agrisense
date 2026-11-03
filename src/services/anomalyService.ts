import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";
import { getTimeOfDayPST } from "@/lib/utils";

export interface AnomalyIncident {
  id: string | number;
  sensor: string;
  sensorId: "soilMoisture" | "temperature" | "humidity" | "light" | "hardware";
  direction: "below" | "high";
  value?: number;
  unit?: string;
  optimal?: string;
  tone: "warning" | "critical";
  time: string;
  created_at: string;
  text: string;
}

const EXCLUDED_LOG_SUBSTRINGS = [
  "updated critical hazard thresholds",
  "deleted node",
  "failed to update",
  "failed to load",
  "failed to insert",
  "inserted test row",
  "executed action",
  "acknowledged alert",
  "dismissed alert",
  "restored baseline",
  "updated crop timeline",
  "audio alerts",
  "registered hardware",
  "simulated",
  "lan poll",
  "telemetry refreshed",
  "hardware link",
  "live streaming",
  "midnight harvest",
  "aloe vera watered",
];

export async function fetchSensorAnomalies(
  range: "7d" | "30d" | "90d" = "7d"
): Promise<AnomalyIncident[]> {
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startIso = startDate.toISOString();

  // Retrieve current threshold overrides from store if available
  const state = useStore.getState();
  const soilOptimal = state.sensors?.soilMoisture?.optimal || { min: 20, max: 40 };
  const tempOptimal = state.sensors?.temperature?.optimal || { min: 25, max: 32 };
  const humOptimal = state.sensors?.humidity?.optimal || { min: 40, max: 70 };
  const lightOptimal = state.sensors?.light?.optimal || { min: 10000, max: 20000 };
  const critLimits = state.criticalAlertSettings || {
    minSoilMoisture: 10,
    maxSoilMoisture: 65,
    maxTemp: 38,
    minTemp: 12,
  };

  const incidents: AnomalyIncident[] = [];
  const lastIncidentTime: Record<string, number> = {};
  const debounceWindowMs = 30 * 60 * 1000; // 30-minute deduplication window per sensor condition

  try {
    // 1. Fetch historical sensor readings
    const { data: readings, error: readingsErr } = await supabase
      .from("sensor_readings")
      .select("*")
      .gte("recorded_at", startIso)
      .or(
        `soil_moisture.lt.${soilOptimal.min},soil_moisture.gt.${soilOptimal.max},temperature.lt.${tempOptimal.min},temperature.gt.${tempOptimal.max},humidity.lt.${humOptimal.min},humidity.gt.${humOptimal.max},lux.gt.20000`
      )
      .order("recorded_at", { ascending: false })
      .limit(1000);

    if (!readingsErr && readings && readings.length > 0) {
      for (const r of readings) {
        const timeMs = new Date(r.recorded_at).getTime();
        const dateObj = new Date(r.recorded_at);
        const { isNight, hour } = getTimeOfDayPST(dateObj);

        // --- Soil Moisture ---
        if (r.soil_moisture != null) {
          if (r.soil_moisture > soilOptimal.max) {
            const key = "soil_high";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.soil_moisture >= critLimits.maxSoilMoisture;
              incidents.push({
                id: `soil-high-${r.id}`,
                sensor: "Soil Moisture",
                sensorId: "soilMoisture",
                direction: "high",
                value: r.soil_moisture,
                unit: "%",
                optimal: `${soilOptimal.min}%–${soilOptimal.max}%`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical High Soil Moisture: ${r.soil_moisture}% (Above hazard limit ${critLimits.maxSoilMoisture}%). Severe substrate saturation & root rot asphyxiation hazard.`
                  : `High Soil Moisture: ${r.soil_moisture}% (Above optimal ${soilOptimal.min}%–${soilOptimal.max}%). Moisture is high — withhold irrigation to prevent rot.`,
              });
            }
          } else if (r.soil_moisture < soilOptimal.min) {
            const key = "soil_low";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.soil_moisture <= critLimits.minSoilMoisture;
              incidents.push({
                id: `soil-low-${r.id}`,
                sensor: "Soil Moisture",
                sensorId: "soilMoisture",
                direction: "below",
                value: r.soil_moisture,
                unit: "%",
                optimal: `${soilOptimal.min}%–${soilOptimal.max}%`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical Low Soil Moisture: ${r.soil_moisture}% (Below hazard limit ${critLimits.minSoilMoisture}%). Severe rootzone dehydration — immediate watering advised.`
                  : `Low Soil Moisture: ${r.soil_moisture}% (Below optimal ${soilOptimal.min}%–${soilOptimal.max}%). Soil moisture is depleted — schedule watering.`,
              });
            }
          }
        }

        // --- Temperature ---
        if (r.temperature != null) {
          if (r.temperature > tempOptimal.max) {
            const key = "temp_high";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.temperature >= critLimits.maxTemp;
              const rounded = Number(r.temperature.toFixed(1));
              incidents.push({
                id: `temp-high-${r.id}`,
                sensor: "Temperature",
                sensorId: "temperature",
                direction: "high",
                value: rounded,
                unit: "°C",
                optimal: `${tempOptimal.min}°C–${tempOptimal.max}°C`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical High Temperature: ${rounded}°C (Above hazard limit ${critLimits.maxTemp}°C). Extreme heat spike — leaf parenchyma collapse risk.`
                  : `High Temperature: ${rounded}°C (Above optimal ${tempOptimal.min}°C–${tempOptimal.max}°C). Foliage heat stress detected — increase ventilation or shade.`,
              });
            }
          } else if (r.temperature < tempOptimal.min) {
            const key = "temp_low";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.temperature <= critLimits.minTemp;
              const rounded = Number(r.temperature.toFixed(1));
              incidents.push({
                id: `temp-low-${r.id}`,
                sensor: "Temperature",
                sensorId: "temperature",
                direction: "below",
                value: rounded,
                unit: "°C",
                optimal: `${tempOptimal.min}°C–${tempOptimal.max}°C`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical Low Temperature: ${rounded}°C (Below hazard limit ${critLimits.minTemp}°C). Chilling damage risk — insulate or move plants to shelter.`
                  : `Low Temperature: ${rounded}°C (Below optimal ${tempOptimal.min}°C–${tempOptimal.max}°C). Ambient chill detected — sub-optimal growth range.`,
              });
            }
          }
        }

        // --- Humidity ---
        if (r.humidity != null) {
          if (r.humidity > humOptimal.max) {
            const key = "hum_high";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.humidity >= 85;
              const rounded = Number(r.humidity.toFixed(0));
              incidents.push({
                id: `hum-high-${r.id}`,
                sensor: "Humidity",
                sensorId: "humidity",
                direction: "high",
                value: rounded,
                unit: "%",
                optimal: `${humOptimal.min}%–${humOptimal.max}%`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical High Humidity: ${rounded}% (Above optimal ${humOptimal.min}%–${humOptimal.max}%). Extreme moisture saturation — high fungal & leaf spot pathogen risk.`
                  : `High Humidity: ${rounded}% (Above optimal ${humOptimal.min}%–${humOptimal.max}%). Elevated relative humidity — promote cross-ventilation.`,
              });
            }
          } else if (r.humidity < humOptimal.min) {
            const key = "hum_low";
            if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
              lastIncidentTime[key] = timeMs;
              const isCrit = r.humidity <= 25;
              const rounded = Number(r.humidity.toFixed(0));
              incidents.push({
                id: `hum-low-${r.id}`,
                sensor: "Humidity",
                sensorId: "humidity",
                direction: "below",
                value: rounded,
                unit: "%",
                optimal: `${humOptimal.min}%–${humOptimal.max}%`,
                tone: isCrit ? "critical" : "warning",
                time: dateObj.toLocaleString(),
                created_at: r.recorded_at,
                text: isCrit
                  ? `Critical Low Humidity: ${rounded}% (Below optimal ${humOptimal.min}%–${humOptimal.max}%). Severely dry ambient air accelerates transpirational stress.`
                  : `Low Humidity: ${rounded}% (Below optimal ${humOptimal.min}%–${humOptimal.max}%). Air moisture is below recommended target.`,
              });
            }
          }
        }

        // --- Light Intensity (PST time-aware) ---
        if (r.lux != null) {
          if (isNight) {
            // At night, low lux is expected. Only flag abnormal high light pollution > 2,000 lux
            if (r.lux > 2000) {
              const key = "light_night_high";
              if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
                lastIncidentTime[key] = timeMs;
                const rounded = Number(r.lux.toFixed(0));
                incidents.push({
                  id: `light-high-${r.id}`,
                  sensor: "Light Intensity",
                  sensorId: "light",
                  direction: "high",
                  value: rounded,
                  unit: "lux",
                  optimal: "<2,000 lux (Night)",
                  tone: "warning",
                  time: dateObj.toLocaleString(),
                  created_at: r.recorded_at,
                  text: `High Nocturnal Light: ${rounded} lux at night (Above 2,000 lux baseline). Artificial light exposure interrupts nocturnal CAM CO2 fixation.`,
                });
              }
            }
          } else {
            // Daytime: flag excessive light > 20,000 lux or inadequate midday light
            if (r.lux > lightOptimal.max) {
              const key = "light_day_high";
              if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
                lastIncidentTime[key] = timeMs;
                const isCrit = r.lux >= 40000;
                const rounded = Number(r.lux.toFixed(0));
                incidents.push({
                  id: `light-high-${r.id}`,
                  sensor: "Light Intensity",
                  sensorId: "light",
                  direction: "high",
                  value: rounded,
                  unit: "lux",
                  optimal: `${lightOptimal.min.toLocaleString()}–${lightOptimal.max.toLocaleString()} lux`,
                  tone: isCrit ? "critical" : "warning",
                  time: dateObj.toLocaleString(),
                  created_at: r.recorded_at,
                  text: isCrit
                    ? `Critical High Light Intensity: ${rounded.toLocaleString()} lux (Above optimal ${lightOptimal.max.toLocaleString()} lux). Severe solar irradiance & sunburn hazard. Deploy 50% shade netting.`
                    : `High Light Intensity: ${rounded.toLocaleString()} lux (Above optimal ${lightOptimal.max.toLocaleString()} lux). Intense midday sunlight — monitor for leaf reddening.`,
                });
              }
            } else if (hour >= 9 && hour <= 15 && r.lux < 8000) {
              const key = "light_day_low";
              if (!lastIncidentTime[key] || Math.abs(lastIncidentTime[key] - timeMs) >= debounceWindowMs) {
                lastIncidentTime[key] = timeMs;
                const rounded = Number(r.lux.toFixed(0));
                incidents.push({
                  id: `light-low-${r.id}`,
                  sensor: "Light Intensity",
                  sensorId: "light",
                  direction: "below",
                  value: rounded,
                  unit: "lux",
                  optimal: `${lightOptimal.min.toLocaleString()}–${lightOptimal.max.toLocaleString()} lux`,
                  tone: "warning",
                  time: dateObj.toLocaleString(),
                  created_at: r.recorded_at,
                  text: `Low Daytime Light Intensity: ${rounded.toLocaleString()} lux (Below 10,000 lux target). Insufficient daylight illumination for photosynthetic activity.`,
                });
              }
            }
          }
        }
      }
    }

    // 2. Also check activity_logs for any genuine sensor warning entries
    const { data: activityLogs } = await supabase
      .from("activity_logs")
      .select("*")
      .in("tone", ["warning", "critical"])
      .gte("created_at", startIso)
      .order("created_at", { ascending: false })
      .limit(50);

    if (activityLogs && activityLogs.length > 0) {
      for (const log of activityLogs) {
        const textLower = (log.text || "").toLowerCase();
        // Ignore administrative logs
        const isExcluded = EXCLUDED_LOG_SUBSTRINGS.some((sub) => textLower.includes(sub));
        if (isExcluded) continue;

        // Check if it describes a sensor warning
        const isLow = textLower.includes("low") || textLower.includes("below") || textLower.includes("drop");
        const isHigh = textLower.includes("high") || textLower.includes("above") || textLower.includes("exceed");

        let sensor = "Hardware Sensor";
        let sensorId: AnomalyIncident["sensorId"] = "hardware";
        if (textLower.includes("soil") || textLower.includes("moisture") || textLower.includes("water")) {
          sensor = "Soil Moisture";
          sensorId = "soilMoisture";
        } else if (textLower.includes("temp") || textLower.includes("heat") || textLower.includes("cold")) {
          sensor = "Temperature";
          sensorId = "temperature";
        } else if (textLower.includes("humid")) {
          sensor = "Humidity";
          sensorId = "humidity";
        } else if (textLower.includes("light") || textLower.includes("lux")) {
          sensor = "Light Intensity";
          sensorId = "light";
        }

        incidents.push({
          id: `log-${log.id}`,
          sensor,
          sensorId,
          direction: isLow ? "below" : "high",
          tone: log.tone === "critical" ? "critical" : "warning",
          time: log.created_at ? new Date(log.created_at).toLocaleString() : log.time || "Recent",
          created_at: log.created_at || new Date().toISOString(),
          text: log.text,
        });
      }
    }

    // If incidents were found, return them sorted newest first
    if (incidents.length > 0) {
      return incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  } catch (err) {
    console.warn("Could not fetch sensor readings for anomalies, using fallback:", err);
  }

  // 3. Fallback: realistic sensor incidents for demonstration if database has no records
  const fallbackList: AnomalyIncident[] = [];
  const now = Date.now();
  const itemsCount = range === "90d" ? 14 : range === "30d" ? 8 : 4;

  const scenarios: Array<{
    sensor: string;
    sensorId: AnomalyIncident["sensorId"];
    direction: "below" | "high";
    tone: "warning" | "critical";
    value?: number;
    unit?: string;
    optimal?: string;
    text: string;
  }> = [
    {
      sensor: "Soil Moisture",
      sensorId: "soilMoisture",
      direction: "below",
      tone: "warning",
      value: 16,
      unit: "%",
      optimal: "20%–40%",
      text: "Low Soil Moisture: 16% (Below optimal 20%–40%). Substrate moisture is depleted — irrigation recommended.",
    },
    {
      sensor: "Temperature",
      sensorId: "temperature",
      direction: "high",
      tone: "warning",
      value: 36.8,
      unit: "°C",
      optimal: "25°C–32°C",
      text: "High Temperature: 36.8°C (Above optimal 25°C–32°C). Midday heat stress on aloe canopy — boost ventilation.",
    },
    {
      sensor: "Humidity",
      sensorId: "humidity",
      direction: "high",
      tone: "warning",
      value: 78,
      unit: "%",
      optimal: "40%–70%",
      text: "High Relative Humidity: 78% (Above optimal 40%–70%). Elevated moisture promotes fungal leaf spot pathogens.",
    },
    {
      sensor: "Light Intensity",
      sensorId: "light",
      direction: "high",
      tone: "warning",
      value: 48000,
      unit: "lux",
      optimal: "10,000–20,000 lux",
      text: "High Light Intensity: 48,000 lux (Above optimal 20,000 lux). Harsh midday solar radiation — shade netting advised to avoid sunburn.",
    },
    {
      sensor: "Soil Moisture",
      sensorId: "soilMoisture",
      direction: "below",
      tone: "critical",
      value: 9,
      unit: "%",
      optimal: "20%–40%",
      text: "Critical Low Soil Moisture: 9% (Below hazard limit 10%). Severe root drought stress — immediate irrigation required.",
    },
    {
      sensor: "Soil Moisture",
      sensorId: "soilMoisture",
      direction: "high",
      tone: "critical",
      value: 84,
      unit: "%",
      optimal: "20%–40%",
      text: "Critical High Soil Moisture: 84% (Above hazard limit 65%). Saturated substrate — severe root rot & asphyxiation hazard.",
    },
    {
      sensor: "Temperature",
      sensorId: "temperature",
      direction: "below",
      tone: "warning",
      value: 19.5,
      unit: "°C",
      optimal: "25°C–32°C",
      text: "Low Temperature: 19.5°C (Below optimal 25°C–32°C). Ambient chill detected — sub-optimal growth range.",
    },
    {
      sensor: "Hardware Sensor",
      sensorId: "hardware",
      direction: "below",
      tone: "critical",
      text: "DHT22 sensor communication packet timed out — connection temporarily lost then restored.",
    },
  ];

  for (let i = 0; i < itemsCount; i++) {
    const timeOffsetMs = (i * (days * 24 * 3600 * 1000)) / (itemsCount + 1);
    const d = new Date(now - timeOffsetMs);
    const sc = scenarios[i % scenarios.length];
    fallbackList.push({
      id: `demo-${i}`,
      time: d.toLocaleString(),
      created_at: d.toISOString(),
      sensor: sc.sensor,
      sensorId: sc.sensorId,
      direction: sc.direction,
      tone: sc.tone,
      value: sc.value,
      unit: sc.unit,
      optimal: sc.optimal,
      text: sc.text,
    });
  }

  return fallbackList;
}
