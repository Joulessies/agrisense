import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface SensorInput {
  value: number;
  unit: string;
  optimal: { min: number; max: number };
}

function buildPrompt(sensors: Record<string, SensorInput>): string {
  const lines = Object.entries(sensors).map(([key, s]) => {
    const status =
      s.value < s.optimal.min ? 'BELOW optimal' : s.value > s.optimal.max ? 'ABOVE optimal' : 'within optimal range';
    return `- ${key}: ${s.value}${s.unit} (optimal ${s.optimal.min}–${s.optimal.max}${s.unit}) — ${status}`;
  });

  return `You are an expert agricultural AI assistant specializing in protected cultivation of aloe vera.
Analyze the following real-time greenhouse sensor readings and provide 2-4 concise, actionable insights.

Current sensor readings:
${lines.join('\n')}

Respond with a JSON array of insight objects. Each object must have exactly these fields:
- "title": A short (≤8 words) insight title
- "body": A 1-2 sentence actionable recommendation
- "type": One of "ok", "tip", or "warning"

Respond ONLY with the raw JSON array — no markdown fences, no extra text.`;
}

export async function POST(req: NextRequest) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_') || GEMINI_API_KEY.length < 10) {
    return NextResponse.json({
      insights: [
        {
          title: 'Gemini API key not configured',
          body: 'Add your GEMINI_API_KEY to .env.local and restart the dev server to enable AI insights.',
          type: 'warning',
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
        },
      ],
    });
  }
}
