
function evaluateAloeCondition(daysWithoutWater, soilMoisture, tempMax, tempMin, uvIndex, sunExposure) {
  const alerts = [];

  if (soilMoisture > 55 || (soilMoisture > 45 && daysWithoutWater <= 2)) {
    return {
      stress: 'overwatering',
      condition: 'Overwatered / Root Rot Risk',
      symptom: 'Yellow, soft, mushy leaves; root rot risk',
    };
  }

  if (daysWithoutWater >= 22) {
    return {
      stress: 'critical_drought',
      condition: 'Critical Condition (Severe Drought)',
      symptom: 'Leaves extremely thin, lower leaves dried/dead, root damage possible, low recovery chance',
    };
  }
  if (daysWithoutWater >= 15) {
    return {
      stress: 'high_stress',
      condition: 'High Stress (Survival Mode)',
      symptom: 'Leaves shriveled/wrinkled, tips brown, leaves may droop; survival mode pero buhay pa',
    };
  }
  if (daysWithoutWater >= 10) {
    return {
      stress: 'mild_water_stress',
      condition: 'Mild Water Stress (Delayed Watering)',
      symptom: 'Leaves slightly thinning and softening, growth slowed; recoverable when watered',
    };
  }

  if (tempMax >= 35) {
    return {
      stress: 'heat_stress',
      condition: 'Extreme Heat Stress',
      symptom: 'Leaf tips dry/brown, leaves thin/curled',
    };
  }
  if (tempMin <= 12) {
    return {
      stress: 'cold_stress',
      condition: 'Cold Stress (Highland Area)',
      symptom: 'Growth slowed/stopped, leaves soften, root rot risk if wet',
    };
  }

  if (uvIndex >= 8 && sunExposure === 'full') {
    return {
      stress: 'sunburn',
      condition: 'Sunburn Exposure Risk',
      symptom: 'Brown or reddish spots, discoloration, dry stressed leaves',
    };
  }

  if (daysWithoutWater >= 7) {
    return {
      stress: 'monitor',
      condition: 'Approaching Watering Interval',
      symptom: 'Water aloe vera soon before reaching 10-day stress threshold',
    };
  }

  return {
    stress: 'optimal',
    condition: 'Optimal Plant Health',
    symptom: 'Leaves plump, firm, deep green',
  };
}

const tests = [
  { name: '4 days unwatered, optimal moisture', days: 4, moisture: 30, tMax: 30, tMin: 24, uv: 6, sun: 'partial', expected: 'optimal' },
  { name: '8 days unwatered (approaching tag-init limit)', days: 8, moisture: 20, tMax: 31, tMin: 24, uv: 6, sun: 'partial', expected: 'monitor' },
  { name: '12 days unwatered (delayed watering)', days: 12, moisture: 16, tMax: 31, tMin: 24, uv: 6, sun: 'partial', expected: 'mild_water_stress' },
  { name: '18 days unwatered (extended drought)', days: 18, moisture: 10, tMax: 32, tMin: 24, uv: 6, sun: 'partial', expected: 'high_stress' },
  { name: '25 days unwatered (severe 3-4 weeks drought)', days: 25, moisture: 5, tMax: 33, tMin: 24, uv: 6, sun: 'partial', expected: 'critical_drought' },
  { name: 'Persistent wet soil (overwatering)', days: 1, moisture: 60, tMax: 29, tMin: 24, uv: 5, sun: 'partial', expected: 'overwatering' },
  { name: 'High heat > 35°C (heat stress)', days: 3, moisture: 28, tMax: 36, tMin: 26, uv: 7, sun: 'partial', expected: 'heat_stress' },
  { name: 'Highland cold < 12°C (cold stress)', days: 3, moisture: 28, tMax: 20, tMin: 11, uv: 5, sun: 'partial', expected: 'cold_stress' },
  { name: 'Harsh midday sun (sunburn)', days: 3, moisture: 28, tMax: 33, tMin: 24, uv: 9, sun: 'full', expected: 'sunburn' },
];

let allPassed = true;
tests.forEach((t) => {
  const result = evaluateAloeCondition(t.days, t.moisture, t.tMax, t.tMin, t.uv, t.sun);
  const pass = result.stress === t.expected;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${t.name} -> Result: ${result.stress} (${result.condition})`);
  if (!pass) allPassed = false;
});

if (allPassed) {
  console.log('\nAll Aloe Vera agronomic condition tests PASSED with 100% accuracy!');
} else {
  console.error('\nSome condition tests failed.');
  process.exit(1);
}
