import { createAdminClient } from "@/lib/supabase";

const OFFLINE_MS = 3 * 60 * 1000;
const LIMITS = {
  minSoil: 10,
  maxSoil: 65,
  maxTemp: 38,
  minTemp: 12,
  minHum: 25,
  maxHum: 85,
};

type Reading = {
  recorded_at: string;
  device_id: string | null;
  soil_moisture: number | null;
  temperature: number | null;
  humidity: number | null;
};

function manilaStamp(value: string | number) {
  return new Date(value).toLocaleString("en-US", { timeZone: "Asia/Manila" });
}

async function notify(body: Record<string, unknown>) {
  const port = process.env.PORT || 3000;
  const response = await fetch(`http://127.0.0.1:${port}/api/notifications/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (payload.delivered && !payload.duplicate) {
    console.log(`[AgriSense live alert] ${payload.subject}`);
  } else if (!payload.delivered) {
    console.error("[AgriSense live alert] not delivered", payload.error || response.status);
  }
}

export function startLiveAlertWatcher() {
  const tick = async () => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("sensor_readings")
        .select("recorded_at,device_id,soil_moisture,temperature,humidity")
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (error || !data?.[0]) return;

      const row = data[0] as Reading;
      const recipient = process.env.ALERT_EMAIL || "agrisense.alerts@gmail.com";
      const portalUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const age = Date.now() - new Date(row.recorded_at).getTime();
      const lastKnown = `Soil ${row.soil_moisture ?? "—"}%, ${row.temperature ?? "—"}°C, humidity ${row.humidity ?? "—"}%`;
      const base = {
        recipient,
        portalUrl,
        zone: "Aloe Vera Zone #1",
        nodeId: row.device_id || "agrisense-001",
        lastKnown,
      };

      if (age > OFFLINE_MS) {
        await notify({
          ...base,
          type: "disconnect",
          hazardType: "Node Communication Timeout",
          currentReading: "Offline",
          threshold: "Max 3 minutes latency",
          timestamp: manilaStamp(row.recorded_at),
        });
        return;
      }

      await notify({
        ...base,
        type: "recovery",
        hazardType: "Hardware Node Reconnected & Telemetry Restored",
        currentReading: "Online (Signal Active)",
        threshold: "Healthy Packet Stream",
        timestamp: manilaStamp(Date.now()),
      });

      const checks: Array<{
        value: number | null;
        hazard: string | null;
        recovery: string;
        threshold: string;
        safe: string;
      }> = [
        {
          value: row.soil_moisture,
          hazard:
            row.soil_moisture != null && row.soil_moisture < LIMITS.minSoil
              ? "Critical Low Soil Moisture (Drought Stress)"
              : row.soil_moisture != null && row.soil_moisture > LIMITS.maxSoil
                ? "Critical High Soil Moisture (Root Rot Hazard)"
                : null,
          recovery: "Soil moisture returned to the safe range",
          threshold: `< ${LIMITS.minSoil}% or > ${LIMITS.maxSoil}%`,
          safe: `${LIMITS.minSoil}%–${LIMITS.maxSoil}%`,
        },
        {
          value: row.temperature,
          hazard:
            row.temperature != null && row.temperature > LIMITS.maxTemp
              ? "Critical High Temperature (Heatwave Stress)"
              : row.temperature != null && row.temperature < LIMITS.minTemp
                ? "Critical Low Temperature (Chilling Stress)"
                : null,
          recovery: "Temperature returned to the safe range",
          threshold: `> ${LIMITS.maxTemp}°C or < ${LIMITS.minTemp}°C`,
          safe: `${LIMITS.minTemp}°C–${LIMITS.maxTemp}°C`,
        },
        {
          value: row.humidity,
          hazard:
            row.humidity != null && row.humidity > LIMITS.maxHum
              ? "Excessive Relative Humidity (Fungal Pathogen Risk)"
              : row.humidity != null && row.humidity < LIMITS.minHum
                ? "Extreme Aridity (Desiccation Hazard)"
                : null,
          recovery: "Humidity returned to the safe range",
          threshold: `> ${LIMITS.maxHum}% or < ${LIMITS.minHum}%`,
          safe: `${LIMITS.minHum}%–${LIMITS.maxHum}%`,
        },
      ];

      for (const check of checks) {
        if (check.value == null || Number.isNaN(check.value)) continue;
        await notify({
          ...base,
          type: check.hazard ? "hazard" : "recovery",
          hazardType: check.hazard || check.recovery,
          currentReading: String(check.value),
          threshold: check.hazard ? check.threshold : check.safe,
          timestamp: manilaStamp(row.recorded_at),
        });
      }
    } catch (err) {
      console.error("[AgriSense live alert]", err);
    }
  };

  setTimeout(() => void tick(), 3000);
  setInterval(() => void tick(), 60_000);
}
