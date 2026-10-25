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
  if (s.value === null || s.value === undefined || isNaN(s.value)) {
    return { num: "—", unit: "" };
  }
  const num = formatNumber(s.value, s.decimals);
  const unit = s.unit === "lux" ? " lux" : s.unit;
  return { num, unit };
}

export function getPhilippineHour(date: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    const utcHours = date.getUTCHours();
    return (utcHours + 8) % 24;
  }
}

export function getTimeOfDayPST(date: Date = new Date()): {
  hour: number;
  isNight: boolean;
  isDusk: boolean;
  period: "day" | "dusk" | "night";
} {
  const hour = getPhilippineHour(date);
  const isNight = hour >= 18 || hour < 6;
  const isDusk = hour === 17;
  const period = isNight ? "night" : isDusk ? "dusk" : "day";
  return { hour, isNight, isDusk, period };
}

export function getStatus(sensor: SensorData, date: Date = new Date()) {
  const v = sensor.value;
  if (v === null || v === undefined || isNaN(v)) return "disconnected";

  const { min, max } = sensor.optimal;

  // Adaptive handling for light intensity (BH1750) based on Philippine Standard Time
  if (sensor.id === "light" || sensor.unit === "lux") {
    const { isNight, isDusk } = getTimeOfDayPST(date);
    if (isNight) {
      // Natural nighttime darkness: low lux (down to 0) is expected and healthy for CAM plants.
      // Only flag if abnormally high light exposure occurs at night (>2,000 lux).
      if (v > 2000) return "high";
      return "ok";
    }
    if (isDusk) {
      // Late afternoon / sunset: light naturally declines
      if (v > max) return "high";
      return "ok";
    }
  }

  if (v < min) return "low";
  if (v > max) return "high";
  return "ok";
}

export function getStatusBadge(sensor: SensorData, date: Date = new Date()) {
  const s = getStatus(sensor, date);

  if (s === "disconnected") {
    return {
      label: "Disconnected",
      icon: "fa-plug-circle-xmark",
      bg: "bg-rose-100",
      text: "text-rose-700",
    };
  }

  const { isNight, isDusk } = getTimeOfDayPST(date);

  if (sensor.id === "light" || sensor.unit === "lux") {
    if (isNight) {
      return {
        label: "Nighttime",
        icon: "fa-moon",
        bg: "bg-indigo-100",
        text: "text-indigo-800",
      };
    }
    if (isDusk) {
      return {
        label: "Sunset / Dusk",
        icon: "fa-cloud-sun",
        bg: "bg-amber-100",
        text: "text-amber-800",
      };
    }
  }

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

export function calculateAloeVitality(sensors: Record<string, SensorData>, date: Date = new Date()) {
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

  const { isNight, isDusk, period, hour } = getTimeOfDayPST(date);

  let lightScore: number;
  let score: number;

  if (isNight) {
    // Nighttime: Aloe Vera stomata open for CAM CO2 capture. Darkness is natural.
    // Exclude low lux from penalizing vitality.
    // Re-distribute weights: Moisture 45%, Temp 30%, Humidity 25%.
    lightScore = 100; // Expected nocturnal baseline
    score = Math.min(
      100,
      Math.max(
        10,
        Math.round(
          moistureScore * 0.45 +
            tempScore * 0.30 +
            humidityScore * 0.25
        )
      )
    );
  } else if (isDusk) {
    // Late afternoon / dusk: light is diminishing
    lightScore = light < 5000 ? 90 : getScore(light, 10000, 35000, 5000, 45000);
    score = Math.min(
      100,
      Math.max(
        10,
        Math.round(
          moistureScore * 0.40 +
            tempScore * 0.25 +
            humidityScore * 0.25 +
            lightScore * 0.10
        )
      )
    );
  } else {
    // Daytime: normal daylight expectations
    lightScore = getScore(light, 20000, 42000, 15000, 48000);
    score = Math.min(
      100,
      Math.max(
        10,
        Math.round(
          moistureScore * 0.35 +
            tempScore * 0.25 +
            humidityScore * 0.20 +
            lightScore * 0.20
        )
      )
    );
  }

  const status =
    score >= 85
      ? "Optimal Condition"
      : score >= 65
      ? "Moderate Stress"
      : "Critical Attention";

  return {
    score,
    status,
    moistureScore,
    tempScore,
    humidityScore,
    lightScore,
    isNight,
    isDusk,
    period,
    philippineHour: hour,
  };
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

export function getCalendarDaysDiff(fromDateStr?: string | Date | null, toDate: Date = new Date()): number {
  if (!fromDateStr) return 0;
  try {
    const from = new Date(fromDateStr);
    if (isNaN(from.getTime())) return 0;

    const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const toMidnight = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();

    const diffMs = toMidnight - fromMidnight;
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}


