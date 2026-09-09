import { SensorData } from "@/store/useStore";

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function formatNumber(value: number, decimals = 0) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatSensorValue(s: SensorData) {
  const num = formatNumber(s.value, s.decimals);
  const unit = s.unit === "lux" ? " lux" : s.unit;
  return { num, unit };
}

export function getStatus(sensor: SensorData) {
  const v = sensor.value;
  const { min, max } = sensor.optimal;
  if (v < min) return "low";
  if (v > max) return "high";
  return "ok";
}

export function getStatusBadge(sensor: SensorData) {
  const s = getStatus(sensor);
  if (s === "ok") {
    return {
      label: "Optimal",
      icon: "fa-circle-check",
      bg: "bg-agri-100",
      text: "text-agri-700",
    };
  }
  if (s === "low") {
    return {
      label: "Warning",
      icon: "fa-triangle-exclamation",
      bg: "bg-amber-100",
      text: "text-amber-700",
    };
  }
  return {
    label: "High",
    icon: "fa-triangle-exclamation",
    bg: "bg-rose-100",
    text: "text-rose-700",
  };
}

export function calculateAloeVitality(sensors: Record<string, SensorData>) {
  const getScore = (val: number, idealMin: number, idealMax: number, safeMin: number, safeMax: number) => {
    if (val >= idealMin && val <= idealMax) return 100;
    if (val >= safeMin && val <= safeMax) {
      const dist = val < idealMin ? idealMin - val : val - idealMax;
      const span = val < idealMin ? idealMin - safeMin : safeMax - idealMax;
      return Math.max(65, Math.round(100 - (dist / (span || 1)) * 30));
    }
    const dist = val < safeMin ? safeMin - val : val - safeMax;
    return Math.max(15, Math.round(60 - dist * 2));
  };

  const moisture = sensors.soilMoisture?.value ?? 25;
  const temp = sensors.temperature?.value ?? 28;
  const humidity = sensors.humidity?.value ?? 55;
  const light = sensors.light?.value ?? 25000;

  const moistureScore = getScore(moisture, 18, 32, 15, 38);
  const tempScore = getScore(temp, 24, 32, 20, 35);
  const humidityScore = getScore(humidity, 45, 65, 38, 72);
  const lightScore = getScore(light, 20000, 42000, 15000, 48000);

  const score = Math.min(
    100,
    Math.max(
      10,
      Math.round(
        moistureScore * 0.35 +
          tempScore * 0.25 +
          humidityScore * 0.2 +
          lightScore * 0.2
      )
    )
  );

  const status =
    score >= 85
      ? "Optimal Condition"
      : score >= 65
      ? "Moderate Stress"
      : "Critical Attention";

  return { score, status, moistureScore, tempScore, humidityScore, lightScore };
}

export function showToast(message: string, tone: "ok" | "info" | "warning" | "error" = "ok") {
  if (typeof document === "undefined") return;
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  const bgClass =
    tone === "ok"
      ? "toast-success"
      : tone === "warning"
      ? "toast-warning"
      : tone === "error"
      ? "toast-error"
      : "";

  toast.className = `toast ${bgClass}`;

  const icon =
    tone === "ok"
      ? "fa-circle-check"
      : tone === "warning"
      ? "fa-triangle-exclamation"
      : tone === "error"
      ? "fa-circle-xmark"
      : "fa-circle-info";

  toast.innerHTML = `<i class="fa-solid ${icon} text-sm shrink-0"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3500);
}

