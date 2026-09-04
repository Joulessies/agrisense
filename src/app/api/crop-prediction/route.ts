import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request JSON' }, { status: 400 });
  }

  const {
    location,
    currentSensors,
    weatherSummary,
    forecastDays,
    farmSettings,
    daysWithoutWater,
    calculatedStress,
  } = body;

  const prompt = `You are an expert agronomist specializing in Aloe Vera (Aloe Barbadensis) cultivation in tropical Philippine greenhouse and open-field microclimates.

Analyze this farm data and weather forecast:

LOCATION:
- City/Region: ${location?.name || 'Philippines'}, ${location?.region || ''}

CURRENT TELEMETRY:
- Soil Moisture: ${currentSensors?.soilMoisture ?? 20}%
- Ambient Temp: ${currentSensors?.temperature ?? 28}°C
- Humidity: ${currentSensors?.humidity ?? 65}%
- Light Intensity: ${currentSensors?.light ?? 15000} lux
- Days without watering / rain: ${daysWithoutWater} days
- Setup: Pot Size = ${farmSettings?.potSize || 'medium'}, Sun Exposure = ${farmSettings?.sunExposure || 'partial'}, Soil = ${farmSettings?.soilType || 'standard'}

WEATHER FORECAST (NEXT 7 DAYS):
- Total Rain Expected: ${weatherSummary?.totalRainExpectedMm ?? 0} mm across ${weatherSummary?.rainExpectedDays ?? 0} rainy days
- Max Upcoming Temp: ${weatherSummary?.maxUpcomingTemp ?? 32}°C (${weatherSummary?.heatStressDays ?? 0} days ≥ 35°C)
- Min Upcoming Temp: ${weatherSummary?.minUpcomingTemp ?? 24}°C (${weatherSummary?.coldStressDays ?? 0} days ≤ 12°C)
- UV Index Alerts: ${weatherSummary?.highUvDays ?? 0} days with extreme UV
- Forecast Timeline:
${(forecastDays || [])
  .slice(0, 5)
  .map(
    (d: any) =>
      `  * ${d.date}: ${d.description}, High ${d.tempMax}°C, Low ${d.tempMin}°C, Rain ${d.rainMm}mm (${Math.round(
        d.pop * 100
      )}% chance), UV ${d.uvIndex}`
  )
  .join('\n')}

CURRENT DIAGNOSIS:
- Status: ${calculatedStress || 'Monitor'}

AGRONOMIC RULES SPECIFIC TO THIS FARMER:
1. Dry season watering interval is 7-10 days max. If dry season and not watered for:
   - 10-14 days: Mild water stress (leaves thin slightly, soften, slowed growth, recoverable).
   - 15-21 days: High stress / survival mode (shriveled leaves, brown tips, drooping; severe water deficit).
   - > 3-4 weeks (22+ days): Critical condition (leaves very thin, lower leaves dead, root damage, low recovery).
   - Aggravated by: full sun all day, small pot, fast drying soil, no midday shade.
2. Rainy season interval is 14-21 days.
3. Overwatering causes: root rot, yellow/soft/mushy leaves, plant may die.
4. Temperature >35°C causes brown tips, curled leaves, heat stress.
5. Temperature <12°C causes growth arrest and softens leaves (cold stress in highland climates).
6. Harsh midday direct sun causes sunburn (reddish/brown spots, dry stressed leaves).

PROVIDE A JSON RESPONSE with this EXACT schema in English:
{
  "prognosis": "2-3 sentence executive agricultural summary of the upcoming 7 days in English.",
  "recommendedAction": "Primary immediate action to take today or this week in English.",
  "leafOutlook": "Description of what the aloe leaves will physically look like in 5-7 days if no action is taken vs if action is taken.",
  "weatherImpactAnalysis": "Specific analysis of how the upcoming rain or heat will directly alter soil moisture and plant hydration.",
  "riskLevel": "Low" | "Moderate" | "High" | "Critical"
}

Respond ONLY with valid JSON. No markdown blocks, no prefix or suffix.`;

  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;

  const isDry = (weatherSummary?.totalRainExpectedMm ?? 0) < 5;
  const isHot = (weatherSummary?.maxUpcomingTemp ?? 30) >= 33;
  const risk =
    daysWithoutWater >= 15 ? 'High' : daysWithoutWater >= 10 ? 'Moderate' : 'Low';

  const defaultLocalAnalysis = {
    prognosis: `Over the next 7 days in ${location?.name || 'the area'}, ${
      isDry
        ? 'dry conditions and warm temperatures will continue to draw down soil reserves.'
        : 'intermittent showers will provide supplemental moisture.'
    } Since the aloe vera has been without watering for ${daysWithoutWater} days, careful irrigation timing is vital.`,
    recommendedAction:
      daysWithoutWater >= 10
        ? 'Water the aloe thoroughly before noon within the next 24-48 hours.'
        : isDry
        ? 'Maintain monitoring; prepare to irrigate as the 7-10 day dry season threshold approaches.'
        : 'Hold off on supplemental irrigation; allow forecasted natural rainfall to moisten the soil.',
    leafOutlook:
      daysWithoutWater >= 10
        ? 'Leaves will begin noticeably thinning and softening if left unwatered; watering immediately will restore full turgidity and thickness within 3-4 days.'
        : 'Leaves remain firm, plump, and healthy green under current moisture levels.',
    weatherImpactAnalysis: `Forecast indicates max temperatures around ${
      weatherSummary?.maxUpcomingTemp ?? 32
    }°C with ${weatherSummary?.totalRainExpectedMm ?? 0}mm of rain expected over the week.`,
    riskLevel: risk,
  };

  if (!apiKey || apiKey.includes('YOUR_') || apiKey.length < 10) {
    return NextResponse.json({ aiAnalysis: defaultLocalAnalysis });
  }

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2500,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.warn('[crop-prediction] Gemini API returned error, using fallback:', errText);
      return NextResponse.json({ aiAnalysis: defaultLocalAnalysis });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const cleaned = rawText.replace(/```json?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({ aiAnalysis: parsed });
  } catch (err: any) {
    console.warn('[crop-prediction] Processing error, using fallback:', err);
    return NextResponse.json({ aiAnalysis: defaultLocalAnalysis });
  }
}
