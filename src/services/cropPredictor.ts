import { WeatherData, ForecastDay } from './weather';
import { FarmSettings } from '@/store/useStore';

export type StressLevel = 'optimal' | 'monitor' | 'mild_water_stress' | 'high_stress' | 'critical_drought' | 'overwatering' | 'heat_stress' | 'cold_stress' | 'sunburn';

export interface LeafSymptom {
  thickness: 'Plump & Thick' | 'Slightly Thin' | 'Thin & Flat' | 'Severely Thin / Dried';
  texture: 'Firm & Turgid' | 'Slightly Soft' | 'Shriveled / Wrinkled' | 'Mushy / Translucent' | 'Brittle';
  color: 'Deep Green' | 'Pale Green (Etiolated)' | 'Brown / Reddish Spots (Sunburn)' | 'Brown Tips' | 'Yellowing / Mushy';
  posture: 'Erect & Spreading' | 'Slightly Drooping' | 'Fallen / Collapsed';
  roots: 'Healthy & White' | 'Stressed' | 'Root Desiccation Risk' | 'Root Rot Damaged';
}

export interface DailyPrediction {
  dayIndex: number;
  date: string;
  weather: ForecastDay;
  simulatedSoilMoisture: number;
  simulatedTempMax: number;
  simulatedTempMin: number;
  simulatedLux: number;
  daysWithoutWater: number;
  vitalityScore: number;
  stressLevel: StressLevel;
  primaryCondition: string;
  leafSymptom: LeafSymptom;
  alerts: string[];
}

export interface CropPredictionOutcome {
  currentDaysWithoutWater: number;
  seasonType: 'dry_season' | 'rainy_season';
  recommendedWateringIntervalDays: number;
  nextRecommendedWateringDate: string;
  daysUntilWaterRequired: number;
  urgentActionRequired: boolean;
  overallStatus: {
    title: string;
    tagalogTitle: string;
    level: StressLevel;
    vitalityNow: number;
    vitalityEndOfWeek: number;
    description: string;
    tagalogDescription: string;
  };
  leafSymptoms: LeafSymptom;
  aggravatingFactors: string[];
  actionPlan: {
    priority: 'high' | 'medium' | 'low';
    action: string;
    tagalogAction: string;
    reason: string;
    tagalogReason: string;
  }[];
  dailyForecastTimeline: DailyPrediction[];
}


export function estimateDaysWithoutWater(
  currentSoilMoisture: number,
  manualDays: number | null,
  settings: FarmSettings
): number {
  if (manualDays != null && manualDays >= 0) {
    return manualDays;
  }

  const dryingSpeed =
    (settings.potSize === 'small' ? 1.3 : settings.potSize === 'large_ground' ? 0.75 : 1.0) *
    (settings.sunExposure === 'full' ? 1.25 : settings.sunExposure === 'shaded' ? 0.8 : 1.0) *
    (settings.soilType === 'fast_draining' ? 1.2 : settings.soilType === 'clay' ? 0.85 : 1.0);

  let baseDays = 0;
  if (currentSoilMoisture >= 35) {
    baseDays = Math.max(0, Math.round((45 - currentSoilMoisture) / 5));
  } else if (currentSoilMoisture >= 25) {
    baseDays = 3 + Math.round(((35 - currentSoilMoisture) / 10) * 3);
  } else if (currentSoilMoisture >= 18) {
    baseDays = 6 + Math.round(((25 - currentSoilMoisture) / 7) * 3);
  } else if (currentSoilMoisture >= 13) {
    baseDays = 9 + Math.round(((18 - currentSoilMoisture) / 5) * 4);
  } else if (currentSoilMoisture >= 8) {
    baseDays = 14 + Math.round(((13 - currentSoilMoisture) / 5) * 6);
  } else {
    baseDays = 21 + Math.round((8 - currentSoilMoisture) * 1.5);
  }

  return Math.max(0, Math.round(baseDays / dryingSpeed));
}


export function predictCropOutcomes(
  currentSoilMoisture: number,
  currentTemp: number,
  currentHumidity: number,
  currentLux: number,
  weather: WeatherData,
  settings: FarmSettings,
  manualWateringDays: number | null = null
): CropPredictionOutcome {
  const currentDays = estimateDaysWithoutWater(currentSoilMoisture, manualWateringDays, settings);

  const totalRainMm = weather.summary.totalRainExpectedMm;
  const isTagUlan = totalRainMm > 15 || weather.summary.rainExpectedDays >= 3;
  const seasonType: 'dry_season' | 'rainy_season' = isTagUlan ? 'rainy_season' : 'dry_season';

  const maxWateringInterval = isTagUlan ? 18 : 8;

  const aggravatingFactors: string[] = [];
  if (settings.sunExposure === 'full') {
    aggravatingFactors.push('Full sun exposure all day — accelerated soil moisture depletion');
  }
  if (settings.potSize === 'small') {
    aggravatingFactors.push('Small container size — root ball heats up and dries rapidly');
  }
  if (settings.soilType === 'fast_draining') {
    aggravatingFactors.push('Rapid drainage substrate (sandy / coarse perlite mix)');
  }
  if (weather.summary.heatStressDays > 0) {
    aggravatingFactors.push(`${weather.summary.heatStressDays} upcoming day(s) with peak heat ≥ 35°C`);
  }
  if (weather.summary.highUvDays > 0 && settings.sunExposure !== 'shaded') {
    aggravatingFactors.push('Extreme UV index at midday with no shade netting');
  }

  let runningMoisture = currentSoilMoisture;
  let runningDaysWithoutWater = currentDays;
  const dailyTimeline: DailyPrediction[] = [];

  const potFactor = settings.potSize === 'small' ? 1.4 : settings.potSize === 'large_ground' ? 0.75 : 1.0;
  const sunFactor = settings.sunExposure === 'full' ? 1.3 : settings.sunExposure === 'shaded' ? 0.75 : 1.0;
  const soilFactor = settings.soilType === 'fast_draining' ? 1.25 : settings.soilType === 'clay' ? 0.85 : 1.0;

  weather.forecast.forEach((dayWeather, i) => {
    const tempImpact = Math.max(0.7, dayWeather.tempMax / 28);
    const rainMm = dayWeather.rainMm;
    const isRainyDay = rainMm >= 3.0 || dayWeather.pop >= 0.65;

    const dailyDepletion = 2.2 * tempImpact * potFactor * sunFactor * soilFactor;

    if (isRainyDay) {
      const rainGain = Math.min(45, rainMm * 2.8 + 10);
      runningMoisture = Math.min(80, runningMoisture + rainGain);
      runningDaysWithoutWater = 0;
    } else {
      runningMoisture = Math.max(4, runningMoisture - dailyDepletion);
      runningDaysWithoutWater += 1;
    }

    const isCloudy = dayWeather.description.toLowerCase().includes('cloud') || dayWeather.description.toLowerCase().includes('rain');
    const simulatedLux = isCloudy ? 6000 + dayWeather.uvIndex * 800 : 14000 + dayWeather.uvIndex * 1500;

    const { stress, condition, leafSymptom, vitality, alerts } = evaluateAloeCondition(
      runningDaysWithoutWater,
      runningMoisture,
      dayWeather.tempMax,
      dayWeather.tempMin,
      dayWeather.uvIndex,
      settings
    );

    dailyTimeline.push({
      dayIndex: i,
      date: dayWeather.date,
      weather: dayWeather,
      simulatedSoilMoisture: Math.round(runningMoisture * 10) / 10,
      simulatedTempMax: dayWeather.tempMax,
      simulatedTempMin: dayWeather.tempMin,
      simulatedLux: Math.round(simulatedLux),
      daysWithoutWater: runningDaysWithoutWater,
      vitalityScore: vitality,
      stressLevel: stress,
      primaryCondition: condition,
      leafSymptom,
      alerts,
    });
  });

  const currentEvaluation = evaluateAloeCondition(
    currentDays,
    currentSoilMoisture,
    currentTemp,
    currentTemp - 5,
    weather.forecast[0]?.uvIndex ?? 6,
    settings
  );

  const daysUntilWaterRequired = Math.max(0, maxWateringInterval - currentDays);
  const urgentActionRequired = currentDays >= maxWateringInterval || currentSoilMoisture < 15 || currentEvaluation.stress === 'overwatering';

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntilWaterRequired);
  const nextRecommendedWateringDate = targetDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const actionPlan = buildActionPlan(
    currentDays,
    currentSoilMoisture,
    isTagUlan,
    weather,
    settings,
    currentEvaluation.stress
  );

  const endOfWeekVitality = dailyTimeline[dailyTimeline.length - 1]?.vitalityScore ?? currentEvaluation.vitality;

  return {
    currentDaysWithoutWater: currentDays,
    seasonType,
    recommendedWateringIntervalDays: maxWateringInterval,
    nextRecommendedWateringDate,
    daysUntilWaterRequired,
    urgentActionRequired,
    overallStatus: {
      title: currentEvaluation.condition,
      tagalogTitle: currentEvaluation.tagalogCondition,
      level: currentEvaluation.stress,
      vitalityNow: currentEvaluation.vitality,
      vitalityEndOfWeek: endOfWeekVitality,
      description: currentEvaluation.description,
      tagalogDescription: currentEvaluation.tagalogDescription,
    },
    leafSymptoms: currentEvaluation.leafSymptom,
    aggravatingFactors,
    actionPlan,
    dailyForecastTimeline: dailyTimeline,
  };
}


function evaluateAloeCondition(
  daysWithoutWater: number,
  soilMoisture: number,
  tempMax: number,
  tempMin: number,
  uvIndex: number,
  settings: FarmSettings
): {
  stress: StressLevel;
  condition: string;
  tagalogCondition: string;
  description: string;
  tagalogDescription: string;
  leafSymptom: LeafSymptom;
  vitality: number;
  alerts: string[];
} {
  const alerts: string[] = [];

  if (soilMoisture > 55 || (soilMoisture > 45 && daysWithoutWater <= 2)) {
    alerts.push('Root Rot Risk: Soil is saturated with water.');
    return {
      stress: 'overwatering',
      condition: 'Overwatered / Root Rot Risk',
      tagalogCondition: 'Overwatered / Root Rot Risk',
      description: 'Persistent moisture prevents oxygen reaching aloe roots, risking deadly fungal root rot.',
      tagalogDescription: 'Persistent moisture prevents oxygen reaching aloe roots, risking deadly fungal root rot.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: 'Mushy / Translucent',
        color: 'Yellowing / Mushy',
        posture: 'Slightly Drooping',
        roots: 'Root Rot Damaged',
      },
      vitality: 45,
      alerts,
    };
  }

  if (tempMax >= 35) {
    alerts.push(`High Temperature (${tempMax}°C): Heat stress on foliage.`);
  }
  if (tempMin <= 12) {
    alerts.push(`Low Temperature (${tempMin}°C): Cold stress on aloe crop.`);
  }

  if (daysWithoutWater >= 22) {
    alerts.push('Critical Drought: Over 3–4 weeks without water in high temperatures.');
    return {
      stress: 'critical_drought',
      condition: 'Critical Condition (Severe Drought)',
      tagalogCondition: 'Critical Condition (Severe Drought)',
      description: 'Severe drought and high heat: leaves are desiccated, bottom foliage dying, root system damaged.',
      tagalogDescription: 'Severe drought and high heat: leaves are desiccated, bottom foliage dying, root system damaged.',
      leafSymptom: {
        thickness: 'Severely Thin / Dried',
        texture: 'Brittle',
        color: 'Brown Tips',
        posture: 'Fallen / Collapsed',
        roots: 'Root Desiccation Risk',
      },
      vitality: 20,
      alerts,
    };
  }

  if (daysWithoutWater >= 15) {
    alerts.push('15–21 days without water: Plant is in survival mode.');
    return {
      stress: 'high_stress',
      condition: 'High Stress (Survival Mode)',
      tagalogCondition: 'High Stress (Survival Mode)',
      description: 'Leaves shriveling, tips turning brown, leaves may droop. Plant is conserving emergency moisture.',
      tagalogDescription: 'Leaves shriveling, tips turning brown, leaves may droop. Plant is conserving emergency moisture.',
      leafSymptom: {
        thickness: 'Thin & Flat',
        texture: 'Shriveled / Wrinkled',
        color: 'Brown Tips',
        posture: 'Slightly Drooping',
        roots: 'Stressed',
      },
      vitality: 48,
      alerts,
    };
  }

  if (daysWithoutWater >= 10) {
    alerts.push('10–14 days without water: Mild water stress detected.');
    return {
      stress: 'mild_water_stress',
      condition: 'Mild Water Stress',
      tagalogCondition: 'Mild Water Stress',
      description: 'Leaves slightly thinning and softening, growth slowed down. Completely recoverable once watered.',
      tagalogDescription: 'Leaves slightly thinning and softening, growth slowed down. Completely recoverable once watered.',
      leafSymptom: {
        thickness: 'Slightly Thin',
        texture: 'Slightly Soft',
        color: 'Deep Green',
        posture: 'Erect & Spreading',
        roots: 'Healthy & White',
      },
      vitality: 70,
      alerts,
    };
  }

  if (tempMax >= 35) {
    return {
      stress: 'heat_stress',
      condition: 'Extreme Heat Stress',
      tagalogCondition: 'Extreme Heat Stress',
      description: 'Prolonged high ambient heat causing brown tip drying and leaf curling.',
      tagalogDescription: 'Prolonged high ambient heat causing brown tip drying and leaf curling.',
      leafSymptom: {
        thickness: 'Slightly Thin',
        texture: 'Firm & Turgid',
        color: 'Brown Tips',
        posture: 'Erect & Spreading',
        roots: 'Healthy & White',
      },
      vitality: 72,
      alerts,
    };
  }

  if (uvIndex >= 8 && settings.sunExposure === 'full') {
    alerts.push('Sunburn Warning: Intense midday direct solar radiation.');
    return {
      stress: 'sunburn',
      condition: 'Sunburn Exposure Risk',
      tagalogCondition: 'Sunburn Exposure Risk',
      description: 'Full midday sun exposure can cause reddish-brown discoloration and scorched leaf tissue.',
      tagalogDescription: 'Full midday sun exposure can cause reddish-brown discoloration and scorched leaf tissue.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: 'Firm & Turgid',
        color: 'Brown / Reddish Spots (Sunburn)',
        posture: 'Erect & Spreading',
        roots: 'Healthy & White',
      },
      vitality: 75,
      alerts,
    };
  }

  if (tempMin <= 12) {
    return {
      stress: 'cold_stress',
      condition: 'Cold Stress (Low Temperatures)',
      tagalogCondition: 'Cold Stress (Low Temperatures)',
      description: 'Growth arrested and leaves softening due to low temperatures under 12°C.',
      tagalogDescription: 'Growth arrested and leaves softening due to low temperatures under 12°C.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: 'Slightly Soft',
        color: 'Pale Green (Etiolated)',
        posture: 'Erect & Spreading',
        roots: 'Stressed',
      },
      vitality: 74,
      alerts,
    };
  }

  if (daysWithoutWater >= 7) {
    return {
      stress: 'monitor',
      condition: 'Approaching Watering Interval',
      tagalogCondition: 'Approaching Watering Interval',
      description: 'Approaching the 7-10 day dry season threshold. Prepare to water in the coming 24-48 hours.',
      tagalogDescription: 'Approaching the 7-10 day dry season threshold. Prepare to water in the coming 24-48 hours.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: 'Firm & Turgid',
        color: 'Deep Green',
        posture: 'Erect & Spreading',
        roots: 'Healthy & White',
      },
      vitality: 88,
      alerts,
    };
  }

  return {
    stress: 'optimal',
    condition: 'Optimal Plant Health',
    tagalogCondition: 'Optimal Plant Health',
    description: 'Soil moisture and weather conditions are well balanced for succulent growth.',
    tagalogDescription: 'Soil moisture and weather conditions are well balanced for succulent growth.',
    leafSymptom: {
      thickness: 'Plump & Thick',
      texture: 'Firm & Turgid',
      color: 'Deep Green',
      posture: 'Erect & Spreading',
      roots: 'Healthy & White',
    },
    vitality: 98,
    alerts,
  };
}


function buildActionPlan(
  daysWithoutWater: number,
  soilMoisture: number,
  isTagUlan: boolean,
  weather: WeatherData,
  settings: FarmSettings,
  stressLevel: StressLevel
) {
  const plan: CropPredictionOutcome['actionPlan'] = [];

  if (stressLevel === 'overwatering') {
    plan.push({
      priority: 'high',
      action: 'Withhold all watering immediately and check drainage',
      tagalogAction: 'Withhold all watering immediately and check drainage',
      reason: 'Root rot can kill the aloe plant within days if soil stays waterlogged.',
      tagalogReason: 'Root rot can kill the aloe plant within days if soil stays waterlogged. Allow soil to dry below 30%.',
    });
    return plan;
  }

  if (daysWithoutWater >= 22) {
    plan.push({
      priority: 'high',
      action: 'Emergency deep soak and move to filtered shade',
      tagalogAction: 'Emergency deep soak and move to filtered shade',
      reason: 'Plant is desiccated past 3-4 weeks. Gentle bottom-watering allows damaged roots to drink without rot shock.',
      tagalogReason: 'Plant is desiccated past 3-4 weeks. Gentle watering and shade protection prevent further foliage loss.',
    });
    return plan;
  }

  if (daysWithoutWater >= 15) {
    plan.push({
      priority: 'high',
      action: 'Thoroughly water plant today before noon',
      tagalogAction: 'Thoroughly water plant today before noon',
      reason: 'Plant has entered survival mode with shriveling leaves and brown tips.',
      tagalogReason: '15–21 days without water. Immediate thorough irrigation is required to restore shriveled leaves.',
    });
    if (settings.sunExposure === 'full') {
      plan.push({
        priority: 'medium',
        action: 'Provide temporary midday shade cloth',
        tagalogAction: 'Provide temporary midday shade cloth',
        reason: 'Prevents intense sun from scorching already stressed, thinned leaves.',
        tagalogReason: 'Shield from harsh midday direct sun while foliage rehydrates.',
      });
    }
    return plan;
  }

  if (daysWithoutWater >= 10) {
    plan.push({
      priority: 'high',
      action: 'Water the aloe vera within the next 24–48 hours',
      tagalogAction: 'Water the aloe vera within the next 24–48 hours',
      reason: 'Leaves are slightly softening and thinning; watering now ensures immediate recovery.',
      tagalogReason: 'Leaves are beginning to thin and soften; prompt irrigation restores optimal turgidity.',
    });
    return plan;
  }

  if (daysWithoutWater >= 7) {
    const willRainSoon = weather.forecast.slice(0, 3).some((d) => d.rainMm >= 4 || d.pop >= 0.6);
    if (willRainSoon) {
      plan.push({
        priority: 'medium',
        action: 'Rain is forecast in the next 1–3 days: Hold off manual watering',
        tagalogAction: 'Rain is forecast in the next 1–3 days: Hold off manual watering',
        reason: 'Forecasted natural rainfall will hydrate the crop without risk of overwatering.',
        tagalogReason: 'Forecasted natural rainfall will hydrate the crop without risk of overwatering.',
      });
    } else {
      plan.push({
        priority: 'medium',
        action: 'Dry season continues: Schedule watering in 1–2 days',
        tagalogAction: 'Dry season continues: Schedule watering in 1–2 days',
        reason: 'Crop has had 1 week without rain or water. Avoid letting it reach the 10-day stress threshold.',
        tagalogReason: 'Crop has had 1 week without rain or water. Irrigate before exceeding the 10-day dry season interval.',
      });
    }
    return plan;
  }

  if (weather.summary.heatStressDays > 0 || weather.summary.highUvDays > 0) {
    plan.push({
      priority: 'low',
      action: 'Shield from harsh midday sunlight (11 AM to 2 PM)',
      tagalogAction: 'Shield from harsh midday sunlight (11 AM to 2 PM)',
      reason: 'Aloe vera thrives in bright indirect light and dislikes harsh all-day direct radiation.',
      tagalogReason: 'Aloe vera thrives in bright indirect light and dislikes harsh all-day direct radiation.',
    });
  } else {
    plan.push({
      priority: 'low',
      action: 'Normal monitoring: Soil is adequately hydrated',
      tagalogAction: 'Normal monitoring: Soil is adequately hydrated',
      reason: `Current watering interval is healthy. Next check recommended in ${Math.max(1, 8 - daysWithoutWater)} days.`,
      tagalogReason: `Current watering interval is healthy. Next check recommended in ${Math.max(1, 8 - daysWithoutWater)} days.`,
    });
  }

  return plan;
}
