import { WeatherData, ForecastDay } from './weather';
import { FarmSettings } from '@/store/useStore';

export type StressLevel = 'optimal' | 'monitor' | 'mild_water_stress' | 'high_stress' | 'critical_drought' | 'overwatering' | 'heat_stress' | 'cold_stress' | 'sunburn';

export interface LeafSymptom {
  thickness: 'Plump & Thick' | 'Slightly Thin' | 'Thin & Flat' | 'Severely Thin / Dried';
  texture: 'Firm & Turgid' | 'Slightly Soft' | 'Shriveled / Wrinkled' | 'Mushy / Translucent' | 'Brittle' | 'Firm & Succulent' | 'Soft / Water-Soaked';
  color: 'Deep Green' | 'Pale Green (Etiolated)' | 'Brown / Reddish Spots (Sunburn)' | 'Brown Tips' | 'Yellowing / Mushy' | 'Vibrant Green' | 'Pale Yellowish';
  posture: 'Erect & Spreading' | 'Slightly Drooping' | 'Fallen / Collapsed' | 'Upright & Turgid';
  roots: 'Healthy & White' | 'Stressed' | 'Root Desiccation Risk' | 'Root Rot Damaged' | 'Healthy & Hydrated';
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

  // When manual watering days are specified by slider or "Watered Today", ensure starting moisture aligns realistically
  let startSoilMoisture = currentSoilMoisture;
  if (manualWateringDays !== null && manualWateringDays >= 0) {
    if (manualWateringDays === 0) {
      // Watered today: freshly hydrated, clamped to realistic post-watering moisture (38% - 50%)
      startSoilMoisture = Math.min(50, Math.max(38, currentSoilMoisture > 65 ? 42 : currentSoilMoisture));
    } else if (manualWateringDays <= 2) {
      // 1-2 days ago: healthy hydrated range
      startSoilMoisture = Math.min(45, Math.max(22, currentSoilMoisture > 65 ? 38 : currentSoilMoisture));
    } else {
      // 3+ days: drying down proportionally with days
      const expectedMoisture = Math.max(6, 38 - manualWateringDays * 1.8);
      startSoilMoisture = Math.min(currentSoilMoisture, expectedMoisture);
    }
  }

  let runningMoisture = startSoilMoisture;
  let runningDaysWithoutWater = currentDays;
  const dailyTimeline: DailyPrediction[] = [];

  const potFactor = settings.potSize === 'small' ? 1.4 : settings.potSize === 'large_ground' ? 0.75 : 1.0;
  const sunFactor = settings.sunExposure === 'full' ? 1.3 : settings.sunExposure === 'shaded' ? 0.75 : 1.0;
  const soilFactor = settings.soilType === 'fast_draining' ? 1.25 : settings.soilType === 'clay' ? 0.85 : 1.0;

  weather.forecast.forEach((dayWeather, i) => {
    // Current day's values: Day 1 (Today) reflects startSoilMoisture and user's current days unwatered
    const simulatedSoilMoisture = i === 0 ? startSoilMoisture : runningMoisture;
    const simulatedDaysUnwatered = i === 0 ? currentDays : runningDaysWithoutWater;

    const isCloudy = dayWeather.description.toLowerCase().includes('cloud') || dayWeather.description.toLowerCase().includes('rain');
    const simulatedLux = isCloudy ? 6000 + dayWeather.uvIndex * 800 : 14000 + dayWeather.uvIndex * 1500;

    const { stress, condition, leafSymptom, vitality, alerts } = evaluateAloeCondition(
      simulatedDaysUnwatered,
      simulatedSoilMoisture,
      dayWeather.tempMax,
      dayWeather.tempMin,
      dayWeather.uvIndex,
      settings
    );

    dailyTimeline.push({
      dayIndex: i,
      date: dayWeather.date,
      weather: dayWeather,
      simulatedSoilMoisture: Math.round(simulatedSoilMoisture * 10) / 10,
      simulatedTempMax: dayWeather.tempMax,
      simulatedTempMin: dayWeather.tempMin,
      simulatedLux: Math.round(simulatedLux),
      daysWithoutWater: simulatedDaysUnwatered,
      vitalityScore: vitality,
      stressLevel: stress,
      primaryCondition: condition,
      leafSymptom,
      alerts,
    });

    // Advance moisture and days unwatered for the subsequent forecast days:
    const tempImpact = Math.max(0.7, dayWeather.tempMax / 28);
    const rainMm = dayWeather.rainMm || 0;

    // Substantial soaking rain (>= 8.0mm) penetrates the potting substrate and resets the drought counter
    const isSoakingRain = rainMm >= 8.0;
    // Moderate rain (3.0mm - 7.9mm) reduces evaporation and slightly dampens surface soil
    const isModerateRain = rainMm >= 3.0 && rainMm < 8.0;

    const baseDailyDepletion = 2.2 * tempImpact * potFactor * sunFactor * soilFactor;
    const evapDamping = isSoakingRain ? 0.1 : isModerateRain ? 0.4 : (dayWeather.pop >= 0.6 ? 0.75 : 1.0);
    const dailyDepletion = baseDailyDepletion * evapDamping;

    if (isSoakingRain) {
      const rainGain = Math.min(35, rainMm * 2.0);
      runningMoisture = Math.min(65, simulatedSoilMoisture + rainGain);
      runningDaysWithoutWater = 0;
    } else if (isModerateRain) {
      const rainGain = Math.min(10, rainMm * 1.0);
      runningMoisture = Math.max(4, Math.min(55, simulatedSoilMoisture + rainGain - dailyDepletion));
      runningDaysWithoutWater = simulatedDaysUnwatered + 1;
    } else {
      runningMoisture = Math.max(4, simulatedSoilMoisture - dailyDepletion);
      runningDaysWithoutWater = simulatedDaysUnwatered + 1;
    }
  });

  const currentEvaluation = evaluateAloeCondition(
    currentDays,
    startSoilMoisture,
    currentTemp,
    currentTemp - 5,
    weather.forecast[0]?.uvIndex ?? 6,
    settings
  );

  const daysUntilWaterRequired = Math.max(0, maxWateringInterval - currentDays);
  const urgentActionRequired = currentDays >= maxWateringInterval || startSoilMoisture < 15 || currentEvaluation.stress === 'overwatering';

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysUntilWaterRequired);
  const nextRecommendedWateringDate = targetDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const actionPlan = buildActionPlan(
    currentDays,
    startSoilMoisture,
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

  // 1. CHRONIC OVERWATERING / ROOT ROT RISK
  // True root rot occurs when soil remains waterlogged (>55%) and fails to drain after 3+ days,
  // or severe stagnant saturation (>70%) persists beyond 2 days without drying.
  const isChronicSaturation = (soilMoisture > 55 && daysWithoutWater >= 3) || (soilMoisture > 70 && daysWithoutWater >= 2);
  if (isChronicSaturation) {
    alerts.push('Root Rot Warning: Potting soil remains waterlogged without draining properly.');
    return {
      stress: 'overwatering',
      condition: 'Overwatered / Poor Drainage Risk',
      tagalogCondition: 'Sobra sa Tubig / Panganib sa Root Rot',
      description: 'Persistent stagnant moisture prevents oxygen from reaching roots. High risk of fungal root rot if drainage is not improved.',
      tagalogDescription: 'Masyadong basâ ang lupa nang matagal nang hindi natutuyo. Siguraduhing may butas ang paso.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: daysWithoutWater >= 5 ? 'Mushy / Translucent' : 'Soft / Water-Soaked',
        color: daysWithoutWater >= 5 ? 'Yellowing / Mushy' : 'Pale Yellowish',
        posture: 'Slightly Drooping',
        roots: 'Root Rot Damaged',
      },
      vitality: daysWithoutWater >= 5 ? 45 : 55,
      alerts,
    };
  }

  // 2. TEMPERATURE & ENVIRONMENTAL STRESS ALERTS
  if (tempMax >= 35) {
    alerts.push(`High Temperature (${tempMax}°C): Heat stress on foliage.`);
  }
  if (tempMin <= 12) {
    alerts.push(`Low Temperature (${tempMin}°C): Cold stress on aloe crop.`);
  }

  // 3. DROUGHT PROGRESSION BASED ON UNWATERED DAYS
  if (daysWithoutWater >= 22) {
    alerts.push('Critical Drought: Over 3–4 weeks without water in high temperatures.');
    return {
      stress: 'critical_drought',
      condition: 'Critical Condition (Severe Drought)',
      tagalogCondition: 'Kritikal na Tagtuyot (3-4 na Linggo)',
      description: 'Severe drought and high heat: leaves are desiccated, bottom foliage dying, root system damaged.',
      tagalogDescription: 'Matinding tagtuyot: nanunuyo at lumalagas na ang mga dahon.',
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
      tagalogCondition: 'Mataas na Stress (Survival Mode)',
      description: 'Leaves shriveling, tips turning brown, leaves may droop. Plant is conserving emergency moisture.',
      tagalogDescription: 'Nangungulubot ang mga dahon at nanunuyo ang mga dulo.',
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
      tagalogCondition: 'Katamtamang Uhaw (Mild Stress)',
      description: 'Leaves slightly thinning and softening, growth slowed down. Completely recoverable once watered.',
      tagalogDescription: 'Medyo lumalambot ang mga dahon; agad babalik sa sigla kapag nadiligan.',
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

  // 4. WEATHER-INDUCED STRESS (Midday Heat, Sunburn, Cold)
  if (tempMax >= 35) {
    return {
      stress: 'heat_stress',
      condition: 'Extreme Heat Stress',
      tagalogCondition: 'Matinding Init (Heat Stress)',
      description: 'Prolonged high ambient heat causing brown tip drying and leaf curling.',
      tagalogDescription: 'Mataas na temperatura sa tanghali na nagdudulot ng pamumula o pagkatuyo ng dulo.',
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
      tagalogCondition: 'Panganib sa Pagkasunog ng Araw (Sunburn)',
      description: 'Full midday sun exposure can cause reddish-brown discoloration and scorched leaf tissue.',
      tagalogDescription: 'Direktang sikat ng araw na nagdudulot ng pamumula ng dahon.',
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
      tagalogCondition: 'Cold Stress (Malamig na Panahon)',
      description: 'Growth arrested and leaves softening due to low temperatures under 12°C.',
      tagalogDescription: 'Nababansot ang paglaki dahil sa sobrang lamig.',
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

  // 5. APPROACHING WATERING INTERVAL (Days 7–9)
  if (daysWithoutWater >= 7) {
    return {
      stress: 'monitor',
      condition: 'Approaching Watering Interval',
      tagalogCondition: 'Palapit na sa Araw ng Pagdidilig',
      description: 'Approaching the 7-10 day dry season threshold. Prepare to water in the coming 24-48 hours.',
      tagalogDescription: 'Nasa ika-7 hanggang 9 na araw na mula noong huling dilig. Maghandang magdilig.',
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

  // 6. FRESHLY WATERED / HYDRATED (Days 0–2)
  if (daysWithoutWater <= 2) {
    if (soilMoisture > 75) {
      alerts.push('Thoroughly Saturated Soil: Allow soil to dry out completely before watering again.');
    }
    return {
      stress: 'optimal',
      condition: 'Optimal / Freshly Watered',
      tagalogCondition: 'Sariwang Dilig / Malusog',
      description: 'Recently watered. Soil is thoroughly moist and succulent leaf parenchyma is fully turgid and hydrated.',
      tagalogDescription: 'Bagong dilig ang halaman. Malusog at mataba ang mga dahon.',
      leafSymptom: {
        thickness: 'Plump & Thick',
        texture: 'Firm & Succulent',
        color: 'Vibrant Green',
        posture: 'Upright & Turgid',
        roots: 'Healthy & Hydrated',
      },
      vitality: 98,
      alerts,
    };
  }

  // 7. OPTIMAL GENERAL HEALTH (Days 3–6)
  return {
    stress: 'optimal',
    condition: 'Optimal Plant Health',
    tagalogCondition: 'Perpektong Kalusugan ng Halaman',
    description: 'Soil moisture and weather conditions are well balanced for succulent growth.',
    tagalogDescription: 'Balanseng-balanse ang moisture at sikat ng araw para sa malusog na paglaki.',
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
