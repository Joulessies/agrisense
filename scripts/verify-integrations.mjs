/**
 * Run: node scripts/verify-integrations.mjs
 * Env (optional): SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
 */
const sbUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const sbKey = process.env.SUPABASE_ANON_KEY || '';
const geminiKey = process.env.GEMINI_API_KEY || '';

async function checkSupabase() {
    if (!sbUrl || !sbKey) {
        console.log('[supabase] SKIP — set SUPABASE_URL and SUPABASE_ANON_KEY');
        return false;
    }
    if (sbKey.startsWith('sb_publishable_')) {
        console.log('[supabase] FAIL — use anon JWT (eyJ…), not sb_publishable_ key');
        return false;
    }
    const res = await fetch(`${sbUrl}/rest/v1/sensor_readings?select=id&limit=1`, {
        headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    });
    const text = await res.text();
    if (res.ok) {
        console.log('[supabase] OK — sensor_readings exists');
        return true;
    }
    if (text.includes('PGRST205')) {
        console.log('[supabase] FAIL — table missing. Run supabase/migrations/sensor_readings.sql in SQL Editor.');
    } else {
        console.log(`[supabase] FAIL — HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return false;
}

async function checkGemini() {
    if (!geminiKey) {
        console.log('[gemini] SKIP — set GEMINI_API_KEY');
        return false;
    }
    if (!geminiKey.startsWith('AIza')) {
        console.log('[gemini] FAIL — key should start with AIza (Google AI Studio)');
        return false;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Return JSON: {"ok":true}' }] }],
            generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 64 },
        }),
    });
    const data = await res.json();
    if (!res.ok) {
        console.log(`[gemini] FAIL — ${data.error?.message || res.status}`);
        return false;
    }
    console.log('[gemini] OK — gemini-2.5-flash reachable');
    return true;
}

const sb = await checkSupabase();
const gm = await checkGemini();
process.exit(sb && gm ? 0 : sb || gm ? 0 : 1);
