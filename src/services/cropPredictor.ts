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
  seasonType: 'tag_init' | 'tag_ulan';
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
  const seasonType = isTagUlan ? 'tag_ulan' : 'tag_init';

  const maxWateringInterval = isTagUlan ? 18 : 8;

  const aggravatingFactors: string[] = [];
  if (settings.sunExposure === 'full') {
    aggravatingFactors.push('Full sun exposure buong araw — mabilis maubos ang reserbang moisture');
  }
  if (settings.potSize === 'small') {
    aggravatingFactors.push('Maliit ang pot — mabilis uminit at matuyo ang root ball');
  }
  if (settings.soilType === 'fast_draining') {
    aggravatingFactors.push('Mabilis matuyo ang lupa (sandy / coarse mix)');
  }
  if (weather.summary.heatStressDays > 0) {
    aggravatingFactors.push(`May ${weather.summary.heatStressDays} araw na aabot sa ≥35°C ang temperatura`);
  }
  if (weather.summary.highUvDays > 0 && settings.sunExposure !== 'shaded') {
    aggravatingFactors.push('Mataas ang UV index sa tanghali — walang shade cloth');
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
    alerts.push('Peligro ng Root Rot: Masyadong babad ang lupa sa tubig.');
    return {
      stress: 'overwatering',
      condition: 'Overwatered / Root Rot Risk',
      tagalogCondition: 'Sobra sa Tubig / Nanganganib mabulok ang ugat',
      description: 'Persistent moisture prevents oxygen reaching aloe roots, risking deadly fungal root rot.',
      tagalogDescription: 'Masyadong basâ ang lupa. Kapag nagpatuloy, mabubulok ang ugat at magiging kulay dilaw at malambot/mushy ang dahon.',
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
    alerts.push(`Mataas na Temperatura (${tempMax}°C): Heat stress sa dahon.`);
  }
  if (tempMin <= 12) {
    alerts.push(`Mababang Temperatura (${tempMin}°C): Cold stress sa aloe.`);
  }

  if (daysWithoutWater >= 22) {
    alerts.push('Lampas 3-4 linggong walang tubig sa matinding init!');
    return {
      stress: 'critical_drought',
      condition: 'Critical Condition (Severe Drought)',
      tagalogCondition: 'Kritikal na Kondisyon (Lampas 3–4 Weeks)',
      description: 'Severe drought and high heat: leaves are desiccated, bottom foliage dying, root system damaged.',
      tagalogDescription: 'Sobrang nipis ng dahon, natutuyo at namamatay ang ibabang mga dahon. Posibleng nasira na ang ugat at mababa ang tiyansang makarecover kapag hindi naagapan.',
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
    alerts.push('15–21 araw na walang dilig: Plant is in survival mode.');
    return {
      stress: 'high_stress',
      condition: 'High Stress (Survival Mode)',
      tagalogCondition: 'Mataas na Stress pero Buhay Pa (15–21 Days)',
      description: 'Leaves shriveling, tips turning brown, leaves may droop. Plant is conserving emergency moisture.',
      tagalogDescription: 'Kulubot at shriveled na ang dahon, nagiging brown ang dulo (tips), at maaaring bumagsak. Nasa survival mode na ang aloe pero buhay pa at kayang iligtas.',
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
    alerts.push('10–14 araw na walang dilig: Medyo delayed watering.');
    return {
      stress: 'mild_water_stress',
      condition: 'Mild Water Stress',
      tagalogCondition: 'Medyo Delayed Watering (10–14 Days)',
      description: 'Leaves slightly thinning and softening, growth slowed down. Completely recoverable once watered.',
      tagalogDescription: 'Medyo numinipis at bahagyang lumalambot ang mga dahon. Mabagal ang growth ngunit mabilis makakabawi kapag diniligan.',
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
      tagalogCondition: 'Sobrang Init ng Panahon (>35°C)',
      description: 'Prolonged high ambient heat causing brown tip drying and leaf curling.',
      tagalogDescription: 'Dahil lampas 35°C ang init, matutuyo ang dulo ng dahon at kukulo o liliit ang katawan ng aloe. Magbigay ng shade at diligin sa madaling araw.',
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
    alerts.push('Babala sa Sunburn: Harsh midday direct sun.');
    return {
      stress: 'sunburn',
      condition: 'Sunburn Exposure Risk',
      tagalogCondition: 'Peligro ng Pagkasunog sa Araw (Sunburn)',
      description: 'Full midday sun exposure can cause reddish-brown discoloration and scorched leaf tissue.',
      tagalogDescription: 'Hindi gusto ng aloe vera ang matinding sikat ng araw buong araw. Nagiging mapula o brown ang dahon kapag nasobrahan sa araw sa tanghali.',
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
      condition: 'Cold Stress (Highland Area)',
      tagalogCondition: 'Cold Stress (Malamig na Klima)',
      description: 'Growth arrested and leaves softening due to low temperatures under 12°C.',
      tagalogDescription: 'Mababa ang temperatura. Titigil ang paglaki at lalambot ang dahon. Bawasan ang pagdidilig upang maiwasan ang mabulok ang ugat.',
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
      tagalogCondition: 'Nalalapit na sa Diligan (7–9 Days)',
      description: 'Approaching the 7-10 day dry season threshold. Prepare to water in the coming 24-48 hours.',
      tagalogDescription: 'Nasa 7–9 na araw nang walang dilig. Maghandang diligan sa darating na 1–2 araw lalo na kapag mainit ang panahon.',
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
    tagalogCondition: 'Napakalusog at Matatag',
    description: 'Soil moisture and weather conditions are well balanced for succulent growth.',
    tagalogDescription: 'Sapat ang tubig at maayos ang kalagayan ng aloe vera. Makakapal, matigas, at malusog ang mga dahon.',
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
      tagalogAction: 'Itigil agad ang pagdidilig at suriin ang drainage ng paso',
      reason: 'Root rot can kill the aloe plant within days if soil stays waterlogged.',
      tagalogReason: 'Madaling mabulok ang ugat (root rot) kapag babad sa tubig. Pababain muna ang lupa sa ilalim ng 30%.',
    });
    return plan;
  }

  if (daysWithoutWater >= 22) {
    plan.push({
      priority: 'high',
      action: 'Emergency deep soak and move to filtered shade',
      tagalogAction: 'I-emergency soak sa tubig at ilagay sa malilim na lugar',
      reason: 'Plant is desiccated past 3-4 weeks. Gentle bottom-watering allows damaged roots to drink without rot shock.',
      tagalogReason: 'Lampas 3-4 linggong walang tubig. Diligan nang dahan-dahan at ilagay sa lilim para hindi lalong masunog ang natitirang dahon.',
    });
    return plan;
  }

  if (daysWithoutWater >= 15) {
    plan.push({
      priority: 'high',
      action: 'Thoroughly water plant today before noon',
      tagalogAction: 'Diligan nang sagana ang aloe vera ngayong araw bago magtanghali',
      reason: 'Plant has entered survival mode with shriveling leaves and brown tips.',
      tagalogReason: '15–21 araw nang walang tubig. Kailangan nang diligan agad upang mabawi ang kulubot na dahon at maiwasan ang tuluyang pagkatuyo.',
    });
    if (settings.sunExposure === 'full') {
      plan.push({
        priority: 'medium',
        action: 'Provide temporary midday shade cloth',
        tagalogAction: 'Maglagay ng shade cloth tuwing 11 AM – 2 PM',
        reason: 'Prevents intense sun from scorching already stressed, thinned leaves.',
        tagalogReason: 'Ilayo sa matinding sikat ng araw ng tanghali habang nagrerecover ang dahon.',
      });
    }
    return plan;
  }

  if (daysWithoutWater >= 10) {
    plan.push({
      priority: 'high',
      action: 'Water the aloe vera within the next 24–48 hours',
      tagalogAction: 'Diligan ang aloe vera sa susunod na 1–2 araw',
      reason: 'Leaves are slightly softening and thinning; watering now ensures immediate recovery.',
      tagalogReason: 'Nagsisimula nang numipis at lumambot ang dahon. Mabilis itong makakabawi kapag nadiligan na.',
    });
    return plan;
  }

  if (daysWithoutWater >= 7) {
    const willRainSoon = weather.forecast.slice(0, 3).some((d) => d.rainMm >= 4 || d.pop >= 0.6);
    if (willRainSoon) {
      plan.push({
        priority: 'medium',
        action: 'Rain is forecast in the next 1–3 days: Hold off manual watering',
        tagalogAction: 'May paparating na ulan sa susunod na 1–3 araw: Huwag munang diligan',
        reason: 'Forecasted natural rainfall will hydrate the crop without risk of overwatering.',
        tagalogReason: 'Sapat ang ulan na darating para mabasa ang lupa. Maiiwasan ang overwatering.',
      });
    } else {
      plan.push({
        priority: 'medium',
        action: 'Hot season continues: Schedule watering in 1–2 days',
        tagalogAction: 'Magpapatuloy ang tag-init: Mag-iskedyul ng pagdilig sa susunod na 1–2 araw',
        reason: 'Crop has had 1 week without rain or water. Avoid letting it reach the 10-day stress threshold.',
        tagalogReason: 'Isang linggo na itong walang ulan o dilig. Diligan na bago lumampas sa 10 araw.',
      });
    }
    return plan;
  }

  if (weather.summary.heatStressDays > 0 || weather.summary.highUvDays > 0) {
    plan.push({
      priority: 'low',
      action: 'Shield from harsh midday sunlight (11 AM to 2 PM)',
      tagalogAction: 'Protektahan sa matinding araw ng tanghali (11 AM – 2 PM)',
      reason: 'Aloe vera thrives in bright indirect light and dislikes harsh all-day direct radiation.',
      tagalogReason: 'Hindi gusto ng aloe vera ang buong araw na nakabilad sa matinding init.',
    });
  } else {
    plan.push({
      priority: 'low',
      action: 'Normal monitoring: Soil is adequately hydrated',
      tagalogAction: 'Normal na pagmamanman: Sapat at maganda ang tubig sa lupa',
      reason: `Current watering interval is healthy. Next check recommended in ${Math.max(1, 8 - daysWithoutWater)} days.`,
      tagalogReason: `Nasa maayos na estado ang pananim. Muling suriin makalipas ang ${Math.max(1, 8 - daysWithoutWater)} araw.`,
    });
  }

  return plan;
}
