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
