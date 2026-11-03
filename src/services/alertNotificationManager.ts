import { supabase } from "@/lib/supabase";
import { useStore } from "@/store/useStore";

export interface AlertHistoryRecord {
  id: string;
  created_at: string;
  hazard_type: string;
  sensor_id: string;
  reading_value: string;
  threshold_limit: string;
  status: "active" | "resolved";
  triggered_at: string;
  resolved_at?: string | null;
  duration_seconds?: number | null;
  email_sent: boolean;
  recipient: string;
}

interface ActiveHazardState {
  active: boolean;
  alertId: string;
  hazardType: string;
  readingValue: string;
  thresholdLimit: string;
  triggeredAt: number;
}

const STORAGE_KEY = "agrisense_active_hazards_state";
const HISTORY_KEY = "agrisense_alert_history_local";

class AlertNotificationManager {
  private activeHazards: Record<string, ActiveHazardState> = {};
  private isProcessing = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) this.activeHazards = JSON.parse(saved);
      } catch {
        this.activeHazards = {};
      }
    }
  }

  private saveState() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.activeHazards));
      } catch {}
    }
  }

  /**
   * Save alert record to Supabase or local storage fallback
   */
  public async logAlert(record: Omit<AlertHistoryRecord, "created_at">): Promise<void> {
    const fullRecord: AlertHistoryRecord = {
      ...record,
      created_at: new Date().toISOString(),
    };

    // 1. Save to local fallback cache
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const list: AlertHistoryRecord[] = raw ? JSON.parse(raw) : [];
        const existingIdx = list.findIndex((x) => x.id === fullRecord.id);
        if (existingIdx >= 0) {
          list[existingIdx] = fullRecord;
        } else {
          list.unshift(fullRecord);
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
      } catch {}
    }

    // 2. Try persisting to Supabase alert_history table
    try {
      const { error } = await supabase.from("alert_history").upsert([fullRecord]);
      if (error) {
        // If alert_history table is missing or fails, log to activity_logs table as audit trail
        await supabase.from("activity_logs").insert([
          {
            time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
            text: `[Alert History] ${fullRecord.hazard_type}: ${fullRecord.reading_value} (Status: ${fullRecord.status})`,
            tone: fullRecord.status === "active" ? "warning" : "ok",
          },
        ]);
      }
    } catch {
      // Fallback silently preserved in local cache
    }
  }

  /**
   * Get alert history list (combines database & local storage)
   */
  public async getAlertHistory(): Promise<AlertHistoryRecord[]> {
    try {
      const { data, error } = await supabase
        .from("alert_history")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        return data as AlertHistoryRecord[];
      }
    } catch {}

    // Fallback to local cache
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(HISTORY_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  }

  /**
   * Dispatch email via Next.js API route
   */
  public async dispatchEmail(payload: {
    type: "hazard" | "recovery" | "disconnect" | "test";
    recipient: string;
    hazardType: string;
    currentReading: string;
    threshold: string;
    nodeId?: string;
    zone?: string;
  }): Promise<{ success: boolean; simulated?: boolean; message?: string }> {
    try {
      const res = await fetch("/api/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          timestamp: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
          portalUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      });

      const json = await res.json();
      return json;
    } catch (err: any) {
      console.error("[AlertNotificationManager] Dispatch failed:", err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Evaluates live telemetry with Anti-Spam state machine
   */
  public async evaluateTelemetry(readings: {
    soilMoisture?: number | null;
    temperature?: number | null;
    humidity?: number | null;
    lux?: number | null;
  }) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const state = useStore.getState();
      const {
        emailAlertsEnabled,
        moderatorEmail,
        emailRecoveryEnabled,
        criticalAlertSettings,
        sensors,
      } = state;

      const soilLimits = criticalAlertSettings || {
        minSoilMoisture: 10,
        maxSoilMoisture: 65,
        maxTemp: 38,
        minTemp: 12,
      };

      const soilOptimal = sensors.soilMoisture?.optimal || { min: 20, max: 40 };
      const tempOptimal = sensors.temperature?.optimal || { min: 25, max: 32 };
      const humOptimal = sensors.humidity?.optimal || { min: 40, max: 70 };

      const checks = [
        // 1. Soil Moisture
        {
          key: "soilMoisture",
          sensorLabel: "Soil Moisture",
          val: readings.soilMoisture,
          unit: "%",
          isHazard: (v: number) => v < soilLimits.minSoilMoisture || v > soilLimits.maxSoilMoisture,
          hazardName: (v: number) =>
            v < soilLimits.minSoilMoisture
              ? "Critical Low Soil Moisture (Drought Stress)"
              : "Critical High Soil Moisture (Root Rot Hazard)",
          thresholdDesc: `< ${soilLimits.minSoilMoisture}% or > ${soilLimits.maxSoilMoisture}% (Optimal: ${soilOptimal.min}%–${soilOptimal.max}%)`,
          safeRangeDesc: `${soilOptimal.min}%–${soilOptimal.max}%`,
        },
        // 2. Temperature
        {
          key: "temperature",
          sensorLabel: "Temperature",
          val: readings.temperature,
          unit: "°C",
          isHazard: (v: number) => v > soilLimits.maxTemp || v < soilLimits.minTemp,
          hazardName: (v: number) =>
            v > soilLimits.maxTemp
              ? "Critical High Temperature (Heatwave Stress)"
              : "Critical Low Temperature (Chilling Stress)",
          thresholdDesc: `> ${soilLimits.maxTemp}°C or < ${soilLimits.minTemp}°C (Optimal: ${tempOptimal.min}°C–${tempOptimal.max}°C)`,
          safeRangeDesc: `${tempOptimal.min}°C–${tempOptimal.max}°C`,
        },
        // 3. Humidity
        {
          key: "humidity",
          sensorLabel: "Humidity",
          val: readings.humidity,
          unit: "%",
          isHazard: (v: number) => v > 85 || v < 25,
          hazardName: (v: number) =>
            v > 85
              ? "Excessive Relative Humidity (Fungal Pathogen Risk)"
              : "Extreme Aridity (Desiccation Hazard)",
          thresholdDesc: `> 85% or < 25% (Optimal: ${humOptimal.min}%–${humOptimal.max}%)`,
          safeRangeDesc: `${humOptimal.min}%–${humOptimal.max}%`,
        },
      ];

      for (const chk of checks) {
        if (chk.val == null || isNaN(chk.val)) continue;

        const isCurrentlyHazard = chk.isHazard(chk.val);
        const existing = this.activeHazards[chk.key];
        const formattedVal = `${chk.val}${chk.unit}`;

        if (isCurrentlyHazard) {
          // --- TRANSITION: NORMAL -> HAZARD ---
          if (!existing || !existing.active) {
            const alertId = `hazard-${chk.key}-${Date.now()}`;
            const hazardType = chk.hazardName(chk.val);
            const triggeredAt = Date.now();

            this.activeHazards[chk.key] = {
              active: true,
              alertId,
              hazardType,
              readingValue: formattedVal,
              thresholdLimit: chk.thresholdDesc,
              triggeredAt,
            };
            this.saveState();

            // Log active hazard
            await this.logAlert({
              id: alertId,
              hazard_type: hazardType,
              sensor_id: chk.key,
              reading_value: formattedVal,
              threshold_limit: chk.thresholdDesc,
              status: "active",
              triggered_at: new Date(triggeredAt).toISOString(),
              email_sent: Boolean(emailAlertsEnabled && moderatorEmail),
              recipient: moderatorEmail || "N/A",
            });

            // Dispatch Hazard Email if enabled
            if (emailAlertsEnabled && moderatorEmail) {
              await this.dispatchEmail({
                type: "hazard",
                recipient: moderatorEmail,
                hazardType,
                currentReading: formattedVal,
                threshold: chk.thresholdDesc,
                zone: "Aloe Vera Zone #1",
              });
            }
          }
          // If already active, DO NOTHING! (Anti-spam suppression)
        } else {
          // --- TRANSITION: HAZARD -> RECOVERED (NORMAL) ---
          if (existing && existing.active) {
            const durationSec = Math.max(1, Math.round((Date.now() - existing.triggeredAt) / 1000));
            const hazardType = existing.hazardType;
            const alertId = existing.alertId;

            // Reset state
            this.activeHazards[chk.key] = {
              ...existing,
              active: false,
            };
            this.saveState();

            // Update log to resolved
            await this.logAlert({
              id: alertId,
              hazard_type: hazardType,
              sensor_id: chk.key,
              reading_value: formattedVal,
              threshold_limit: chk.safeRangeDesc,
              status: "resolved",
              triggered_at: new Date(existing.triggeredAt).toISOString(),
              resolved_at: new Date().toISOString(),
              duration_seconds: durationSec,
              email_sent: Boolean(emailRecoveryEnabled && moderatorEmail),
              recipient: moderatorEmail || "N/A",
            });

            // Dispatch Recovery Email if enabled
            if (emailRecoveryEnabled && moderatorEmail) {
              await this.dispatchEmail({
                type: "recovery",
                recipient: moderatorEmail,
                hazardType,
                currentReading: formattedVal,
                threshold: chk.safeRangeDesc,
                zone: "Aloe Vera Zone #1",
              });
            }
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Monitor sensor node disconnection
   */
  public async evaluateHardwareConnectivity(isDisconnected: boolean, lastSeenTime?: string | Date) {
    const state = useStore.getState();
    const { emailDisconnectEnabled, emailAlertsEnabled, moderatorEmail } = state;
    const existing = this.activeHazards["hardware"];

    if (isDisconnected) {
      if (!existing || !existing.active) {
        const alertId = `fault-hw-${Date.now()}`;
        const triggeredAt = Date.now();
        const timeStr = lastSeenTime ? new Date(lastSeenTime).toLocaleString() : "Recently";

        this.activeHazards["hardware"] = {
          active: true,
          alertId,
          hazardType: "Hardware Communication Timeout",
          readingValue: "Offline",
          thresholdLimit: "> 3 min no packets",
          triggeredAt,
        };
        this.saveState();

        await this.logAlert({
          id: alertId,
          hazard_type: "Hardware Sensor Node Disconnected",
          sensor_id: "hardware",
          reading_value: "Offline",
          threshold_limit: "Packet Watchdog Timeout (> 3m)",
          status: "active",
          triggered_at: new Date(triggeredAt).toISOString(),
          email_sent: Boolean(emailAlertsEnabled && emailDisconnectEnabled && moderatorEmail),
          recipient: moderatorEmail || "N/A",
        });

        if (emailAlertsEnabled && emailDisconnectEnabled && moderatorEmail) {
          await this.dispatchEmail({
            type: "disconnect",
            recipient: moderatorEmail,
            hazardType: "Node Communication Timeout",
            currentReading: "Offline",
            threshold: "Max 3 minutes latency",
            nodeId: "agrisense-001 (ESP32)",
            zone: "Aloe Vera Zone #1",
          });
        }
      }
    } else {
      // Reconnected
      if (existing && existing.active) {
        const durationSec = Math.max(1, Math.round((Date.now() - existing.triggeredAt) / 1000));
        const alertId = existing.alertId;

        this.activeHazards["hardware"] = {
          ...existing,
          active: false,
        };
        this.saveState();

        await this.logAlert({
          id: alertId,
          hazard_type: "Hardware Sensor Node Disconnected",
          sensor_id: "hardware",
          reading_value: "Reconnected",
          threshold_limit: "Active Telemetry Stream",
          status: "resolved",
          triggered_at: new Date(existing.triggeredAt).toISOString(),
          resolved_at: new Date().toISOString(),
          duration_seconds: durationSec,
          email_sent: Boolean(emailAlertsEnabled && moderatorEmail),
          recipient: moderatorEmail || "N/A",
        });

        if (emailAlertsEnabled && moderatorEmail) {
          await this.dispatchEmail({
            type: "recovery",
            recipient: moderatorEmail,
            hazardType: "Hardware Node Reconnected & Telemetry Restored",
            currentReading: "Online (Signal Active)",
            threshold: "Healthy Packet Stream",
            zone: "Aloe Vera Zone #1",
          });
        }
      }
    }
  }
}

export const alertNotificationManager = new AlertNotificationManager();

