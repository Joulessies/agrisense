import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface SensorInput {
  value: number;
  unit: string;
  optimal: { min: number; max: number };
}

const AGRONOMIC_KNOWLEDGE_BASE = [
  {
    topic: "Soil Moisture & Irrigation",
    standard: "Aloe Barbadensis Miller requires intermittent soak-and-dry cycles. Moisture below 20% risks leaf shriveling and gel dehydration; moisture above 40% in standing water promotes fungal soft rot (Erwinia chrysanthemi) and Pythium root rot.",
    citation: "DA-BPI Protected Crops Standard §3.2 & FAO Irrigation 56",
  },
  {
    topic: "Temperature & Thermal Regulation",
    standard: "Optimal diurnal greenhouse temperature is 25°C–32°C. Ambient temperatures exceeding 35°C trigger daytime stomatal closure in CAM succulents, stalling transpiration. Sustained cold below 15°C induces dormancy and chilling injury.",
    citation: "Tropical Crassulacean Agronomy Bulletin #18",
  },
  {
    topic: "Relative Humidity & Pathogen Control",
    standard: "Target greenhouse relative humidity is 40%–70%. Ambient humidity > 75% in warm conditions dramatically accelerates Anthracnose and leaf spot (Colletotrichum gloeosporioides). High humidity requires forced ridge ventilation.",
    citation: "Bureau of Plant Industry Horticultural Disease Prevention Protocol",
  },
  {
    topic: "Light Intensity & Photoprotection",
    standard: "Aloe vera prefers bright, filtered solar radiation (10,000–20,000 lux) during daytime. Direct unfiltered sunlight exceeding 25,000 lux triggers protective rhodoxanthin/anthocyanin reddish-bronze pigmentation (photoinhibition/sunburn). Under 8,000 lux during daytime causes weak etiolated leaves.",
    citation: "International Aloe Science Council (IASC) Agronomic Guidelines",
  },
  {
    topic: "Nocturnal CAM Physiology & Day/Night Photoperiod",
    standard: "Aloe barbadensis Miller is a Crassulacean Acid Metabolism (CAM) succulent. During nighttime (18:00–06:00 PST), light naturally drops to zero/near-zero lux and stomata open to fix atmospheric CO2. Low lux at night is physiologically normal and expected. Do NOT warn about low light or advise supplemental grow lights at night unless artificial photoperiod extension is explicitly ordered. Nighttime watering is strongly discouraged to avoid root/crown fungal rot.",
    citation: "IASC CAM Photobiology Standard §5.1 & Tropical Succulent Guidelines",
  },
];

function getPhilippineHour(): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    const utcHours = new Date().getUTCHours();
    return (utcHours + 8) % 24;
  }
}

function buildPrompt(sensors: Record<string, SensorInput>): string {
  const phHour = getPhilippineHour();
  const isNight = phHour >= 18 || phHour < 6;
  const isDusk = phHour === 17;
  const timeContext = isNight
    ? `Current Observation Time: Nighttime (${phHour}:00 Philippine Standard Time / PST). Natural darkness expected. Darkness is essential for CAM nocturnal CO2 absorption. Do NOT report low lux as an issue or recommend grow lights.`
    : isDusk
    ? `Current Observation Time: Late Afternoon / Sunset (${phHour}:00 PST). Diminishing sunlight is natural.`
    : `Current Observation Time: Daytime (${phHour}:00 PST). Normal daylight requirements apply.`;

  const lines = Object.entries(sensors).map(([key, s]) => {
    let status =
      s.value < s.optimal.min ? 'BELOW optimal' : s.value > s.optimal.max ? 'ABOVE optimal' : 'within optimal range';
    if ((key === 'light' || key === 'lux') && (isNight || isDusk)) {
      status = s.value <= s.optimal.max ? 'within expected nighttime resting level' : 'ABOVE expected nighttime level';
    }
    return `- ${key}: ${s.value}${s.unit} (optimal ${s.optimal.min}–${s.optimal.max}${s.unit}) — ${status}`;
  });

  const knowledgeText = AGRONOMIC_KNOWLEDGE_BASE.map(
    (k) => `[Topic: ${k.topic}]\nStandard: ${k.standard}\nCitation: ${k.citation}`
  ).join('\n\n');

  return `You are AgriSense AGI, an advanced Artificial General Intelligence agronomist system specializing in protected cultivation of Aloe Barbadensis Miller.
You operate on a Retrieval-Augmented Generation (RAG) model grounded strictly in the certified agricultural references below.

Certified Agronomic Knowledge Base:
${knowledgeText}

${timeContext}

Current Real-Time Greenhouse Sensor Readings:
${lines.join('\n')}

Task:
Analyze the live sensor readings against the Certified Agronomic Knowledge Base and current time context.
Provide 2-4 concise, actionable insights. Every insight MUST include its citation from the knowledge base above.
If it is nighttime, focus insights on overnight thermal stability, humidity control against pathogens, and soil moisture status, rather than low light.

Respond with a JSON array of insight objects. Each object must have exactly these fields:
- "title": A short (≤8 words) insight title
- "body": A 1-2 sentence actionable recommendation grounded in the standards
- "type": One of "ok", "tip", or "warning"
- "reference": The exact citation string from the knowledge base (e.g. "DA-BPI Protected Crops Standard §3.2 & FAO Irrigation 56")

Respond ONLY with the raw JSON array — no markdown fences, no extra text.`;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_') || GEMINI_API_KEY.length < 10) {
    return NextResponse.json({
      insights: [
        {
          title: 'AGI Engine key not configured',
          body: 'Add your GEMINI_API_KEY to .env.local and restart the dev server to enable AGI insights.',
          type: 'warning',
          reference: 'System Configuration',
        },
      ],
    });
  }

  let sensors: Record<string, SensorInput>;
  try {
    const body = await req.json();
    sensors = body.sensors;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;

  try {
    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(sensors) }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.warn('[gemini-insights] API error:', errText);
      return NextResponse.json({
        insights: [
          {
            title: 'Telemetry Monitored',
            body: 'Sensor readings are currently being tracked. Adjust irrigation and ventilation to maintain target parameters.',
            type: 'ok',
            reference: 'DA-BPI Protected Crops Standard §3.2 & FAO Irrigation 56',
          },
        ],
      });
    }

    const geminiData = await geminiRes.json();
    const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    const cleaned = text.replace(/```json?/gi, '').replace(/```/g, '').trim();
    const insights = JSON.parse(cleaned);

    return NextResponse.json({ insights: Array.isArray(insights) ? insights : [insights] });
  } catch (e) {
    console.warn('[gemini-insights] Fallback used:', e);
    return NextResponse.json({
      insights: [
        {
          title: 'Irrigation & Telemetry Active',
          body: 'Sensors are streaming live data. Keep soil moisture between 30% and 50% for optimal aloe vera growth.',
          type: 'ok',
          reference: 'DA-BPI Protected Crops Standard §3.2 & FAO Irrigation 56',
        },
      ],
    });
  }
}
