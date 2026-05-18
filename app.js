


if (typeof tailwind !== 'undefined') {
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    agri: {
                        50:  '#f1faf3',
                        100: '#dcf2e1',
                        200: '#bce4c8',
                        300: '#8ccfa3',
                        400: '#57b378',
                        500: '#349658',
                        600: '#247845',
                        700: '#1d5f39',
                        800: '#194c2f',
                        900: '#163f28',
                    },
                },
                fontFamily: {
                    sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                },
                boxShadow: {
                    card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
                },
            },
        },
    };
}


const defaultThresholds = {
    soilMoisture: { min: 20, max: 40 },
    temperature:  { min: 25, max: 32 },
    humidity:     { min: 40, max: 70 },
    light:        { min: 10000, max: 20000 },
};

const state = {
    role: 'farmer',

    sensors: {
        soilMoisture: {
            id: 'soilMoisture', label: 'Soil Moisture', value: 18, unit: '%',
            min: 0, max: 100, decimals: 0,
            optimal: { ...defaultThresholds.soilMoisture },
            icon: 'fa-droplet', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', barColor: 'bg-amber-400',
        },
        temperature: {
            id: 'temperature', label: 'Temperature', value: 28, unit: '°C',
            min: 0, max: 50, decimals: 0,
            optimal: { ...defaultThresholds.temperature },
            icon: 'fa-temperature-half', iconBg: 'bg-agri-50', iconColor: 'text-agri-600', barColor: 'bg-agri-500',
        },
        humidity: {
            id: 'humidity', label: 'Humidity', value: 65, unit: '%',
            min: 0, max: 100, decimals: 0,
            optimal: { ...defaultThresholds.humidity },
            icon: 'fa-cloud', iconBg: 'bg-sky-50', iconColor: 'text-sky-500', barColor: 'bg-sky-400',
        },
        light: {
            id: 'light', label: 'Light Intensity', value: 15000, unit: 'lux',
            min: 0, max: 25000, decimals: 0,
            optimal: { ...defaultThresholds.light },
            icon: 'fa-sun', iconBg: 'bg-yellow-50', iconColor: 'text-yellow-500', barColor: 'bg-yellow-400',
        },
    },

    plant: { age: 180, harvestAge: 240 },

    activity: [
        { time: '8:24 AM', text: 'Soil moisture dropped to 18% in Zone B', tone: 'warning' },
        { time: '7:52 AM', text: 'Temperature stabilized at 28°C',         tone: 'ok' },
        { time: '7:30 AM', text: 'Sensor node A-03 reconnected',            tone: 'info' },
    ],

    nodes: [
        { id: 'A-01', zone: 'Zone A', type: 'Soil & moisture',       battery: 87, signal: 92, online: true  },
        { id: 'A-02', zone: 'Zone A', type: 'Temperature & humidity', battery: 73, signal: 88, online: true  },
        { id: 'A-03', zone: 'Zone A', type: 'Soil & moisture',       battery: 64, signal: 75, online: true  },
        { id: 'B-01', zone: 'Zone B', type: 'Soil & moisture',       battery: 91, signal: 80, online: true  },
        { id: 'B-02', zone: 'Zone B', type: 'Light intensity',        battery: 55, signal: 70, online: true  },
        { id: 'C-01', zone: 'Zone C', type: 'Multi-sensor',          battery: 22, signal: 65, online: true  },
        { id: 'C-02', zone: 'Zone C', type: 'Multi-sensor',          battery: 0,  signal: 0,  online: false },
    ],

    irrigation: { active: false },
    lastSync: new Date(),
    analyticsRange: '7d',
    dismissedAlerts: new Set(),

    /* IoT device connection (HTTP REST polling).
     * - enabled: user clicked Connect
     * - status: 'idle' | 'connecting' | 'connected' | 'error'
     * - pollerId: setInterval handle so we can stop polling cleanly
     */
    device: {
        enabled: false,
        endpoint: 'http://192.168.1.50/api/readings',
        pollIntervalMs: 5000,
        status: 'idle',
        lastError: null,
        consecutiveErrors: 0,
        pollerId: null,
    },

    /* Supabase REST (same table as ESP32). Keys stored in localStorage when set in Settings. */
    supabase: {
        projectUrl: '',
        anonKey: '',
        logLimit: 50,
        rows: [],
        lastError: null,
        loading: false,
    },

    /** Google Gemini API key (Settings). Persisted in localStorage. */
    gemini: {
        apiKey: '',
    },

    /** AI insights: primary = Google Gemini JSON; fallback = heuristics if Gemini fails. */
    aiInsights: {
        updatedAt: null,
        loading: false,
        error: null,
        source: 'none',
        geminiItems: null,
        autoFetchAttempted: false,
    },
};

/* Restore persisted device config if available. */
try {
    const savedEndpoint = localStorage.getItem('agrisense.device.endpoint');
    const savedInterval = localStorage.getItem('agrisense.device.pollIntervalMs');
    if (savedEndpoint) state.device.endpoint = savedEndpoint;
    if (savedInterval) state.device.pollIntervalMs = Number(savedInterval) || 5000;
    const sbUrl = localStorage.getItem('agrisense.supabase.url');
    const sbKey = localStorage.getItem('agrisense.supabase.anonKey');
    const sbLim = localStorage.getItem('agrisense.supabase.logLimit');
    if (sbUrl) state.supabase.projectUrl = sbUrl;
    if (sbKey) state.supabase.anonKey = sbKey;
    if (sbLim) state.supabase.logLimit = Math.min(500, Math.max(1, Number(sbLim) || 50));
    const geminiKey = localStorage.getItem('agrisense.gemini.apiKey');
    if (geminiKey) state.gemini.apiKey = geminiKey;
} catch (_) {
    /* localStorage may be unavailable (file://) — ignore silently. */
}

/* ============================================================
 * 3) HELPERS
 * ============================================================ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function formatSensorValue(s) {
    const num = formatNumber(s.value, s.decimals);
    const unit = s.unit === 'lux' ? ' lux' : s.unit;
    return { num, unit };
}

function getStatus(sensor) {
    const v = sensor.value;
    const { min, max } = sensor.optimal;
    if (v < min) return 'low';
    if (v > max) return 'high';
    return 'ok';
}

function getStatusBadge(sensor) {
    const s = getStatus(sensor);
    if (s === 'ok')  return { label: 'Optimal',  icon: 'fa-circle-check',          bg: 'bg-agri-100',  text: 'text-agri-700'  };
    if (s === 'low') return { label: 'Warning',  icon: 'fa-triangle-exclamation',  bg: 'bg-amber-100', text: 'text-amber-700' };
    return                  { label: 'High',     icon: 'fa-triangle-exclamation',  bg: 'bg-rose-100',  text: 'text-rose-700'  };
}

function timeBasedGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
}

/* ---------- Toasts ---------- */
function toast(message, type = 'info', timeout = 2600) {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check'
              : type === 'warning' ? 'fa-triangle-exclamation'
              : type === 'error'   ? 'fa-circle-xmark'
              : 'fa-circle-info';
    el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 200);
    }, timeout);
}

/* ============================================================
 * 4) RENDERERS
 * ============================================================ */

function renderSensorCards() {
    const grid = $('#sensorGrid');
    if (!grid) return;

    grid.innerHTML = '';
    Object.values(state.sensors).forEach(s => {
        const badge = getStatusBadge(s);
        const status = getStatus(s);
        const pct = clamp(((s.value - s.min) / (s.max - s.min)) * 100, 2, 100);

        let barClass = s.barColor;
        if (status === 'low')  barClass = 'bg-amber-400';
        if (status === 'high') barClass = 'bg-rose-400';

        const { num, unit } = formatSensorValue(s);
        const optMin = formatNumber(s.optimal.min, s.decimals);
        const optMax = formatNumber(s.optimal.max, s.decimals);

        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 shadow-card p-5';
        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="w-10 h-10 rounded-lg ${s.iconBg} flex items-center justify-center">
                    <i class="fa-solid ${s.icon} ${s.iconColor}"></i>
                </div>
                <span class="${badge.bg} ${badge.text} text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    <i class="fa-solid ${badge.icon} mr-1"></i>${badge.label}
                </span>
            </div>
            <p class="mt-4 text-xs text-slate-500 uppercase tracking-wide">${s.label}</p>
            <p class="mt-1 text-3xl font-semibold text-slate-900 sensor-value">
                ${num}<span class="text-lg text-slate-400 font-medium">${unit}</span>
            </p>
            <p class="mt-1 text-xs text-slate-500">Optimal: ${optMin}–${optMax}${s.unit === 'lux' ? ' lux' : s.unit}</p>
            <div class="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden sensor-bar">
                <div class="h-full ${barClass}" style="width: ${pct}%"></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderPlantStatus() {
    const card = $('#plantStatusCard');
    if (!card) return;

    const out = Object.values(state.sensors).filter(s => getStatus(s) !== 'ok');
    let label, reason, iconColor, iconBg, icon, vitality, stress, stressColor;

    if (out.length === 0) {
        label = 'Healthy';
        reason = 'All readings within optimal range';
        iconColor = 'text-agri-700'; iconBg = 'bg-agri-100'; icon = 'fa-heart';
        vitality = '92%'; stress = 'Low'; stressColor = 'text-agri-600';
    } else if (out.length === 1) {
        label = 'Warning';
        reason = `${out[0].label} out of range`;
        iconColor = 'text-amber-700'; iconBg = 'bg-amber-100'; icon = 'fa-triangle-exclamation';
        vitality = '72%'; stress = 'Medium'; stressColor = 'text-amber-600';
    } else {
        label = 'Critical';
        reason = `${out.length} sensors out of range`;
        iconColor = 'text-rose-700'; iconBg = 'bg-rose-100'; icon = 'fa-circle-exclamation';
        vitality = '55%'; stress = 'High'; stressColor = 'text-rose-600';
    }

    card.className = 'bg-white rounded-xl border border-slate-200 shadow-card p-5';
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-slate-800">Plant Status</p>
            <i class="fa-solid fa-heart-pulse text-slate-300"></i>
        </div>
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full ${iconBg} flex items-center justify-center">
                <i class="fa-solid ${icon} ${iconColor} text-lg"></i>
            </div>
            <div>
                <p class="text-lg font-semibold ${iconColor}">${label}</p>
                <p class="text-xs text-slate-500">${reason}</p>
                <i class="fa-solid fa-info-circle ml-2 cursor-pointer" title="AI explanation: Placeholder for model insights"></i>
            </div>
        </div>
        <div class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
                <p class="text-[10px] text-slate-400 uppercase">Vitality</p>
                <p class="text-sm font-semibold text-slate-700">${vitality}</p>
            </div>
            <div>
                <p class="text-[10px] text-slate-400 uppercase">Stress</p>
                <p class="text-sm font-semibold ${stressColor}">${stress}</p>
            </div>
            <div>
                <p class="text-[10px] text-slate-400 uppercase">Growth</p>
                <p class="text-sm font-semibold text-slate-700">${out.length > 1 ? 'Slowed' : 'Stable'}</p>
            </div>
        </div>
    `;
}

function renderHarvest() {
    const card = $('#harvestCard');
    if (!card) return;

    const { age, harvestAge } = state.plant;
    const ready = age >= harvestAge;
    const progress = clamp((age / harvestAge) * 100, 0, 100);

    card.className = 'bg-white rounded-xl border border-slate-200 shadow-card p-5';
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-slate-800">Harvest Readiness</p>
            <i class="fa-solid fa-wheat-awn text-slate-300"></i>
        </div>
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full ${ready ? 'bg-agri-100' : 'bg-slate-100'} flex items-center justify-center">
                <i class="fa-solid ${ready ? 'fa-circle-check' : 'fa-hourglass-half'} ${ready ? 'text-agri-600' : 'text-slate-500'} text-lg"></i>
            </div>
            <div>
                <p class="text-lg font-semibold ${ready ? 'text-agri-700' : 'text-slate-700'}">${ready ? 'Ready to Harvest' : 'Not Ready'}</p>
                <p class="text-xs text-slate-500">Plant age: ${age} days</p>
            </div>
        </div>
        <div class="mt-4">
            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>Progress to harvest</span>
                <span class="font-medium text-slate-700">${age} / ${harvestAge} days</span>
            </div>
            <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-agri-500" style="width: ${progress}%; transition: width 500ms ease;"></div>
            </div>
            <p class="mt-2 text-xs text-slate-500">Optimal harvest at ${harvestAge}+ days</p>
        </div>
    `;
}

function buildRecommendations() {
    const recs = [];
    Object.values(state.sensors).forEach(s => {
        const status = getStatus(s);
        if (status === 'ok') return;

        const isLow = status === 'low';
        const map = {
            soilMoisture: isLow
                ? { title: 'Water the plant now', detail: `Add ~1.5 L/m² before noon to reach ${s.optimal.min + 5}% moisture.`, icon: 'fa-droplet', action: { id: 'btnWater', label: 'Start watering', icon: 'fa-faucet-drip' } }
                : { title: 'Pause irrigation',  detail: `Let moisture settle back toward ${s.optimal.max}%.`,                  icon: 'fa-droplet-slash',  action: { id: 'btnPauseIrr',  label: 'Pause irrigation',    icon: 'fa-pause'        } },
            temperature: isLow
                ? { title: 'Warm the greenhouse', detail: `Aim for ${s.optimal.min}–${s.optimal.max}°C.`, icon: 'fa-temperature-arrow-up', action: { id: 'btnClimateUp',   label: 'Run heaters',    icon: 'fa-fire-flame-curved' } }
                : { title: 'Cool the greenhouse', detail: `Reduce to ${s.optimal.min}–${s.optimal.max}°C.`, icon: 'fa-temperature-arrow-down', action: { id: 'btnClimateDown', label: 'Open vents',    icon: 'fa-wind' } },
            humidity: isLow
                ? { title: 'Boost humidity',  detail: `Target: ${s.optimal.min}–${s.optimal.max}%.`, icon: 'fa-cloud-rain', action: { id: 'btnMistersOn',  label: 'Run misters',   icon: 'fa-spray-can' } }
                : { title: 'Reduce humidity', detail: `Target: ${s.optimal.min}–${s.optimal.max}%.`, icon: 'fa-wind',       action: { id: 'btnMistersOff', label: 'Ventilate',     icon: 'fa-wind'      } },
            light: isLow
                ? { title: 'Increase light', detail: `Optimal: ${formatNumber(s.optimal.min)}–${formatNumber(s.optimal.max)} lux.`, icon: 'fa-lightbulb', action: { id: 'btnLightsOn',  label: 'Turn on grow lights', icon: 'fa-lightbulb' } }
                : { title: 'Reduce light',   detail: `Optimal: ${formatNumber(s.optimal.min)}–${formatNumber(s.optimal.max)} lux.`, icon: 'fa-cloud',     action: { id: 'btnLightsOff', label: 'Deploy shade cloth',  icon: 'fa-umbrella'  } },
        };

        const r = map[s.id];
        recs.push({
            sensorId: s.id,
            text: `${r.title} — ${s.label.toLowerCase()} ${isLow ? 'below' : 'above'} optimal range.`,
            detail: r.detail,
            icon: r.icon,
            action: r.action,
        });
    });
    return recs;
}

function renderRecommendations() {
    const card = $('#recommendationsCard');
    if (!card) return;

    const recs = buildRecommendations();

    if (recs.length === 0) {
        card.className = 'rounded-xl border border-agri-200 bg-agri-50 p-5';
        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <p class="text-sm font-semibold text-agri-800">Recommendations</p>
                <span class="text-[11px] font-medium text-agri-700 bg-agri-100 px-2 py-0.5 rounded-full">All clear</span>
            </div>
            <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-lg bg-agri-100 flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-circle-check text-agri-600"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-agri-900 leading-snug">Your crop is thriving — no action required right now.</p>
                    <p class="text-xs text-agri-700 mt-1">We'll keep monitoring and alert you to changes.</p>
                </div>
            </div>
        `;
        return;
    }

    const top = recs[0];
    // No irrigation logic – removed
    card.className = 'rounded-xl border border-amber-200 bg-amber-50 p-5';
    card.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-sm font-semibold text-amber-800">Recommendations</p>
            <span class="text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                ${recs.length > 1 ? recs.length + ' actions' : 'Action needed'}
            </span>
        </div>
        <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <i class="fa-solid ${top.icon} text-amber-600"></i>
            </div>
            <div>
                <p class="text-sm font-medium text-amber-900 leading-snug">${top.text}</p>
                <p class="text-xs text-amber-700 mt-1">${top.detail}</p>
            </div>
        </div>
        <button id="${top.action.id}"
                class="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition">
            <i class="fa-solid ${top.action.icon} text-xs"></i>
            <span>${top.action.label}</span>
        </button>
        ${recs.length > 1 ? `<p class="mt-3 text-[11px] text-amber-700">+${recs.length - 1} more recommendation${recs.length > 2 ? 's' : ''} — see <a href="#" data-go-view="alerts" class="underline font-medium">Alerts</a>.</p>` : ''}
    `;

    // Wire action button
    const btn = $('#' + top.action.id);
    if (btn) {
        btn.addEventListener('click', () => simulateAction(top));
    }

    $$('[data-go-view]', card).forEach(a => {
        a.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveView(a.dataset.goView);
        });
    });}

function renderActivity() {
    const list = $('#activityList');
    if (!list) return;

    if (state.activity.length === 0) {
        list.innerHTML = `<li class="px-5 py-6 text-center text-sm text-slate-400">No activity yet.</li>`;
        return;
    }

    list.innerHTML = state.activity.slice(0, 6).map(item => {
        const dot = item.tone === 'warning'  ? 'bg-amber-400'
                 : item.tone === 'critical' ? 'bg-rose-400'
                 : item.tone === 'ok'       ? 'bg-agri-500'
                 :                            'bg-sky-400';
        return `
            <li class="px-5 py-3 flex items-center gap-3">
                <span class="w-2 h-2 rounded-full ${dot}"></span>
                <span class="flex-1 text-slate-700">${item.text}</span>
                <span class="text-xs text-slate-400">${item.time}</span>
            </li>
        `;
    }).join('');
}

function addActivity(text, tone = 'info') {
    state.activity.unshift({ time: formatTime(new Date()), text, tone });
    if (state.activity.length > 30) state.activity.length = 30;
    renderActivity();
}

function renderAlerts() {
    const container = $('#alertsContent');

    const live = [];
    Object.values(state.sensors).forEach(s => {
        const st = getStatus(s);
        if (st === 'ok') return;
        if (state.dismissedAlerts.has(s.id)) return;
        const severity = st === 'high' && s.value > s.optimal.max * 1.25 ? 'critical' : 'warning';
        live.push({
            sensorId: s.id,
            sensor: s.label,
            severity,
            message: `${s.label} is ${st === 'low' ? 'below' : 'above'} optimal range — currently ${formatNumber(s.value, s.decimals)}${s.unit === 'lux' ? ' lux' : s.unit} (range ${s.optimal.min}–${s.optimal.max}).`,
            time: formatTime(new Date()),
        });
        // Critical humidity toast
        if (s.id === 'humidity' && severity === 'critical') {
            toast(`Critical humidity! ${s.value}${s.unit}`, 'error');
        }
    });

    // Update badge in sidebar
    const badge = $('#sidebarAlertBadge');
    if (badge) {
        if (live.length > 0) {
            badge.textContent = live.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    if (!container) return;

    if (live.length === 0) {
        container.innerHTML = `
            <div class="bg-white rounded-xl border border-slate-200 shadow-card p-10 text-center">
                <div class="w-14 h-14 rounded-2xl bg-agri-50 mx-auto flex items-center justify-center mb-4">
                    <i class="fa-solid fa-circle-check text-agri-600 text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-slate-900">No active alerts</h3>
                <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">All sensor readings are within optimal range. You're good to go!</p>
            </div>
        `;
        return;
    }

    const items = live.map(a => {
        const tone = a.severity === 'critical' ? 'rose' : 'amber';
        return `
            <div class="bg-white rounded-xl border border-${tone}-200 shadow-card p-5 flex items-start gap-4">
                <div class="w-11 h-11 rounded-lg bg-${tone}-50 flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid fa-triangle-exclamation text-${tone}-500"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                        <p class="text-sm font-semibold text-slate-900">${a.sensor}</p>
                        <span class="text-[10px] font-semibold uppercase tracking-wide bg-${tone}-100 text-${tone}-700 px-2 py-0.5 rounded-full">${a.severity}</span>
                    </div>
                    <p class="text-sm text-slate-600 mt-1">${a.message}</p>
                    <p class="text-xs text-slate-400 mt-2">Detected at ${a.time}</p>
                </div>
                <button data-resolve-alert="${a.sensorId}" class="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100">
                    <i class="fa-solid fa-check"></i> Mark as resolved
                </button>
                <button data-dismiss-alert="${a.sensorId}" class="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 ml-1">
                    <i class="fa-solid fa-xmark"></i> Dismiss
                </button>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="flex items-center justify-between mb-4">
            <div>
                <h2 class="text-xl font-semibold text-slate-900">Active alerts</h2>
                <p class="text-sm text-slate-500">${live.length} ${live.length === 1 ? 'condition needs' : 'conditions need'} your attention.</p>
            </div>
            <button id="dismissAllAlerts" class="text-sm text-slate-500 hover:text-slate-700 font-medium">Dismiss all</button>
        </div>
        <div class="space-y-3">${items}</div>
    `;

    $$('[data-resolve-alert]', container).forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = btn.dataset.resolveAlert;
            state.dismissedAlerts.add(sid);
            addActivity(`Alert for ${state.sensors[sid].label} resolved`, 'info');
            toast(`Alert resolved`, 'success');
            renderAlerts();
        });
    });

    $$('[data-dismiss-alert]', container).forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = btn.dataset.dismissAlert;
            state.dismissedAlerts.add(sid);
            addActivity(`Alert for ${state.sensors[sid].label} dismissed`, 'info');
            toast(`Alert dismissed`, 'info');
            renderAlerts();
        });
    });

    $('#dismissAllAlerts')?.addEventListener('click', () => {
        live.forEach(a => state.dismissedAlerts.add(a.sensorId));
        addActivity('All alerts dismissed', 'info');
        toast('All alerts dismissed', 'info');
        renderAlerts();
    });}

function renderSensorsView() {
    const container = $('#sensorsContent');
    if (!container) return;

    const totalNodes = state.nodes.length;
    const online = state.nodes.filter(n => n.online).length;

    const rows = state.nodes.map(n => {
        const batteryColor = n.battery > 50 ? 'text-agri-600' : n.battery > 25 ? 'text-amber-600' : 'text-rose-600';
        const signalColor  = n.signal  > 60 ? 'text-agri-600' : n.signal  > 30 ? 'text-amber-600' : 'text-rose-600';
        const status = n.online
            ? '<span class="text-[11px] font-semibold text-agri-700 bg-agri-100 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1 align-middle"></i>Online</span>'
            : '<span class="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1 align-middle"></i>Offline</span>';

        const action = n.online
            ? `<button data-node-action="restart" data-node-id="${n.id}" class="admin-only text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded border border-slate-200 hover:bg-slate-50">Restart</button>`
            : `<button data-node-action="reconnect" data-node-id="${n.id}" class="text-xs text-agri-700 hover:text-agri-800 font-medium px-2 py-1 rounded border border-agri-200 bg-agri-50 hover:bg-agri-100">Reconnect</button>`;

        return `
            <tr class="border-t border-slate-100 hover:bg-slate-50/60">
                <td class="px-5 py-3 font-medium text-slate-800">${n.id}</td>
                <td class="px-5 py-3 text-slate-600">${n.zone}</td>
                <td class="px-5 py-3 text-slate-600">${n.type}</td>
                <td class="px-5 py-3"><span class="${batteryColor} font-semibold">${n.battery}%</span></td>
                <td class="px-5 py-3"><span class="${signalColor} font-semibold">${n.signal}%</span></td>
                <td class="px-5 py-3">${status}</td>
                <td class="px-5 py-3 text-right">${action}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
            <div class="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <p class="text-xs text-slate-500">Total nodes</p>
                <p class="text-2xl font-semibold text-slate-900 mt-1">${totalNodes}</p>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <p class="text-xs text-slate-500">Online</p>
                <p class="text-2xl font-semibold text-agri-600 mt-1">${online}</p>
            </div>
            <div class="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <p class="text-xs text-slate-500">Offline</p>
                <p class="text-2xl font-semibold text-rose-600 mt-1">${totalNodes - online}</p>
            </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p class="text-sm font-semibold text-slate-800">Sensor nodes</p>
                    <p class="text-xs text-slate-500 mt-0.5">All connected devices across your zones.</p>
                </div>
                <button id="addNodeBtn" class="admin-only text-xs bg-agri-600 hover:bg-agri-700 text-white font-medium px-3 py-1.5 rounded-lg">
                    <i class="fa-solid fa-plus mr-1"></i> Add node
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead class="bg-slate-50">
                        <tr class="text-left text-[11px] uppercase tracking-wide text-slate-500">
                            <th class="px-5 py-2 font-semibold">Node ID</th>
                            <th class="px-5 py-2 font-semibold">Zone</th>
                            <th class="px-5 py-2 font-semibold">Type</th>
                            <th class="px-5 py-2 font-semibold">Battery</th>
                            <th class="px-5 py-2 font-semibold">Signal</th>
                            <th class="px-5 py-2 font-semibold">Status</th>
                            <th class="px-5 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;

    // Wire actions
    $$('[data-node-action]', container).forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.nodeAction;
            const id = btn.dataset.nodeId;
            const node = state.nodes.find(n => n.id === id);
            if (!node) return;

            if (action === 'reconnect') {
                node.online = true;
                node.battery = Math.max(node.battery, 60);
                node.signal  = Math.max(node.signal,  70);
                addActivity(`Sensor node ${id} reconnected`, 'ok');
                toast(`Node ${id} is back online`, 'success');
            } else {
                addActivity(`Sensor node ${id} restarted`, 'info');
                toast(`Node ${id} restarted`, 'info');
            }
            renderSensorsView();
            renderSidebarStats();
        });
    });

    $('#addNodeBtn')?.addEventListener('click', () => {
        const newId = `D-${String(state.nodes.length + 1).padStart(2, '0')}`;
        state.nodes.push({ id: newId, zone: 'Zone D', type: 'Multi-sensor', battery: 100, signal: 100, online: true });
        addActivity(`New sensor node ${newId} provisioned`, 'ok');
        toast(`Node ${newId} added`, 'success');
        renderSensorsView();
        renderSidebarStats();
    });
}

function renderSettings() {
    const container = $('#settingsContent');
    if (!container) return;

    const isAdmin = state.role === 'admin';

    const rows = Object.values(state.sensors).map(s => `
        <div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center py-3 border-b border-slate-100 last:border-0">
            <div class="sm:col-span-3 flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center">
                    <i class="fa-solid ${s.icon} ${s.iconColor} text-xs"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-slate-800">${s.label}</p>
                    <p class="text-[11px] text-slate-500">${s.unit === 'lux' ? 'lux' : s.unit}</p>
                </div>
            </div>
            <div class="sm:col-span-4">
                <label class="text-[10px] text-slate-500 uppercase tracking-wide">Optimal min</label>
                <input type="number" data-threshold="${s.id}" data-bound="min" value="${s.optimal.min}" ${isAdmin ? '' : 'disabled'}
                       class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
            </div>
            <div class="sm:col-span-4">
                <label class="text-[10px] text-slate-500 uppercase tracking-wide">Optimal max</label>
                <input type="number" data-threshold="${s.id}" data-bound="max" value="${s.optimal.max}" ${isAdmin ? '' : 'disabled'}
                       class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
            </div>
            <div class="sm:col-span-1 text-right">
                <button data-reset-threshold="${s.id}" class="admin-only text-xs text-slate-400 hover:text-slate-600" title="Reset to default">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
        </div>
    `).join('');

    /* ---------- Device connection panel ---------- */
    const dev = state.device;
    const statusPill = (() => {
        if (!dev.enabled) return '<span class="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full"><i class="fa-solid fa-plug-circle-xmark mr-1"></i>Disconnected (simulation active)</span>';
        if (dev.status === 'connected') return '<span class="text-[11px] text-agri-700 bg-agri-100 px-2 py-1 rounded-full"><i class="fa-solid fa-plug-circle-check mr-1"></i>Live data flowing</span>';
        if (dev.status === 'error')     return `<span class="text-[11px] text-rose-700 bg-rose-100 px-2 py-1 rounded-full"><i class="fa-solid fa-circle-exclamation mr-1"></i>Error: ${dev.lastError || 'connection failed'}</span>`;
        return '<span class="text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded-full"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Connecting…</span>';
    })();

    const devicePanel = `
        <div class="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
            <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p class="text-sm font-semibold text-slate-800">Device connection</p>
                    <p class="text-xs text-slate-500 mt-0.5">Poll a real IoT gateway over HTTP. Falls back to simulated data when disconnected.</p>
                </div>
                ${statusPill}
            </div>

            <div class="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div class="sm:col-span-8">
                    <label class="text-[10px] text-slate-500 uppercase tracking-wide">Endpoint URL</label>
                    <input id="deviceEndpoint" type="url" value="${dev.endpoint}" ${isAdmin && !dev.enabled ? '' : 'disabled'}
                           placeholder="http://192.168.1.50/api/readings"
                           class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div class="sm:col-span-2">
                    <label class="text-[10px] text-slate-500 uppercase tracking-wide">Poll (ms)</label>
                    <input id="devicePollInterval" type="number" min="500" step="500" value="${dev.pollIntervalMs}" ${isAdmin && !dev.enabled ? '' : 'disabled'}
                           class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div class="sm:col-span-2">
                    ${dev.enabled
                        ? '<button id="deviceDisconnectBtn" class="w-full text-sm px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium">Disconnect</button>'
                        : `<button id="deviceConnectBtn" ${isAdmin ? '' : 'disabled'} class="w-full text-sm px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium disabled:opacity-60 disabled:cursor-not-allowed">Connect</button>`}
                </div>
            </div>

            <div class="px-6 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-xs text-slate-500 leading-relaxed">
                <p class="font-semibold text-slate-600 mb-1"><i class="fa-solid fa-circle-info mr-1 text-slate-400"></i>Expected JSON</p>
                <pre class="font-mono text-[11px] bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-600 whitespace-pre overflow-x-auto">{ "soilMoisture": 22, "temperature": 28, "humidity": 65, "light": 14500 }</pre>
                <p class="mt-2">Aliases accepted: <code class="font-mono">soil_moisture</code>, <code class="font-mono">temp</code>, <code class="font-mono">humid</code>, <code class="font-mono">lux</code>. Nested <code class="font-mono">{ "sensors": { ... } }</code> also works.</p>
                <p class="mt-2"><strong>CORS:</strong> if the device is on a different origin, it must send <code class="font-mono">Access-Control-Allow-Origin: *</code> or the browser will block the request.</p>
                ${isAdmin ? '' : '<p class="mt-2 text-amber-700"><i class="fa-solid fa-lock mr-1"></i>Switch to Admin to change connection settings.</p>'}
            </div>
        </div>
    `;

    const sb = state.supabase;
    const rowsHtml = sb.rows.length === 0
        ? `<tr><td colspan="7" class="px-4 py-6 text-center text-sm text-slate-400">No rows yet — save URL/key and click <strong>Load from Supabase</strong>.</td></tr>`
        : sb.rows.map((r) => `
            <tr class="border-t border-slate-100 hover:bg-slate-50/60 text-sm">
                <td class="px-3 py-2 font-mono text-xs text-slate-600">${r.id ?? '—'}</td>
                <td class="px-3 py-2 text-xs text-slate-700">${r.recorded_at ? new Date(r.recorded_at).toLocaleString() : '—'}</td>
                <td class="px-3 py-2 text-xs">${r.device_id ?? '—'}</td>
                <td class="px-3 py-2">${r.soil_moisture ?? '—'}</td>
                <td class="px-3 py-2">${r.temperature != null ? Number(r.temperature).toFixed(1) : '—'}</td>
                <td class="px-3 py-2">${r.humidity != null ? Number(r.humidity).toFixed(1) : '—'}</td>
                <td class="px-3 py-2">${r.lux != null ? Math.round(r.lux) : '—'}</td>
            </tr>
        `).join('');

    const supabasePanel = `
        <div class="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
            <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p class="text-sm font-semibold text-slate-800">Supabase cloud log</p>
                    <p class="text-xs text-slate-500 mt-0.5">Same <code class="font-mono text-[11px]">sensor_readings</code> table the ESP32 writes to (REST).</p>
                </div>
                ${sb.loading
        ? '<span class="text-[11px] text-amber-700 bg-amber-100 px-2 py-1 rounded-full"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Loading…</span>'
        : '<span class="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full"><i class="fa-solid fa-database mr-1"></i>PostgREST</span>'}
            </div>
            <div class="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div class="sm:col-span-5">
                    <label class="text-[10px] text-slate-500 uppercase tracking-wide">Project URL</label>
                    <input id="supabaseProjectUrl" type="url" value="${sb.projectUrl.replace(/"/g, '&quot;')}" ${isAdmin ? '' : 'disabled'}
                           placeholder="https://YOUR_PROJECT_REF.supabase.co"
                           class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div class="sm:col-span-4">
                    <label class="text-[10px] text-slate-500 uppercase tracking-wide">Anon key</label>
                    <input id="supabaseAnonKey" type="password" value="${sb.anonKey.replace(/"/g, '&quot;')}" ${isAdmin ? '' : 'disabled'}
                           placeholder="eyJ… (Settings → API)"
                           autocomplete="off"
                           class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div class="sm:col-span-1">
                    <label class="text-[10px] text-slate-500 uppercase tracking-wide">Rows</label>
                    <input id="supabaseLogLimit" type="number" min="1" max="500" value="${sb.logLimit}" ${isAdmin ? '' : 'disabled'}
                           class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div class="sm:col-span-2 flex flex-col gap-2">
                    <button id="supabaseLoadBtn" ${sb.loading ? 'disabled' : ''}
                            class="w-full text-sm px-3 py-2 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium disabled:opacity-60">
                        <i class="fa-solid fa-cloud-arrow-down mr-1"></i> Load
                    </button>
                    <button id="supabaseSeedBtn" ${sb.loading || !isAdmin ? 'disabled' : ''}
                            class="admin-only w-full text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium disabled:opacity-60"
                            title="Insert one demo row (requires table + anon insert policy)">
                        <i class="fa-solid fa-flask mr-1"></i> Test row
                    </button>
                </div>
            </div>
            ${isAdmin ? '' : '<p class="px-6 pb-2 text-amber-700 text-xs"><i class="fa-solid fa-lock mr-1"></i>Switch to <strong>Admin</strong> in the top header (next to Farmer) to edit Project URL and Anon key.</p>'}
            ${sb.lastError ? `<div class="px-6 pb-2"><p class="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">${String(formatSupabaseError(sb.lastError)).replace(/</g, '&lt;')}</p></div>` : ''}
            <div class="px-6 py-4 border-t border-slate-100">
                <div class="overflow-x-auto rounded-lg border border-slate-200">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                                <th class="px-3 py-2 font-semibold">ID</th>
                                <th class="px-3 py-2 font-semibold">Time</th>
                                <th class="px-3 py-2 font-semibold">Device</th>
                                <th class="px-3 py-2 font-semibold">Soil %</th>
                                <th class="px-3 py-2 font-semibold">Temp</th>
                                <th class="px-3 py-2 font-semibold">RH%</th>
                                <th class="px-3 py-2 font-semibold">Lux</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
            </div>
            <div class="px-6 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-xs text-slate-500 leading-relaxed">
                <p><strong>SQL:</strong> run <code class="font-mono">supabase/migrations/sensor_readings.sql</code> in the Supabase SQL editor (once per project). ESP32 posts to <code class="font-mono">/rest/v1/sensor_readings</code> every 60s when keys are set. After Load, the newest row updates the dashboard sensors.</p>
            </div>
        </div>
    `;

    const gm = state.gemini;
    const geminiPanel = `
        <div class="bg-white rounded-xl border border-slate-200 shadow-card mb-5">
            <div class="px-6 py-5 border-b border-slate-100">
                <p class="text-sm font-semibold text-slate-800">AI insights (Google Gemini)</p>
                <p class="text-xs text-slate-500 mt-0.5">Powers the <strong>Analytics → AI insights</strong> panel. Free API key from
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-agri-700 font-medium underline">Google AI Studio</a>.
                    Stored only in this browser (localStorage).</p>
            </div>
            <div class="px-6 py-4">
                <label class="text-[10px] text-slate-500 uppercase tracking-wide">Gemini API key</label>
                <input id="geminiApiKey" type="password" value="${gm.apiKey.replace(/"/g, '&quot;')}" ${isAdmin ? '' : 'disabled'}
                       placeholder="AIza…"
                       autocomplete="off"
                       class="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-agri-500/30 focus:border-agri-500 disabled:bg-slate-50 disabled:text-slate-500" />
                <p class="mt-2 text-[11px] text-slate-400">Model: <code class="font-mono">${GEMINI_MODEL}</code> (JSON mode). Do not commit keys to git.</p>
                ${isAdmin ? '' : '<p class="mt-2 text-amber-700 text-xs"><i class="fa-solid fa-lock mr-1"></i>Switch to <strong>Admin</strong> to edit the Gemini key.</p>'}
            </div>
        </div>
    `;

    container.innerHTML = devicePanel + supabasePanel + geminiPanel + `
        <div class="bg-white rounded-xl border border-slate-200 shadow-card">
            <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <p class="text-sm font-semibold text-slate-800">Threshold configuration</p>
                    <p class="text-xs text-slate-500 mt-0.5">Optimal ranges that drive sensor status and alerts.</p>
                </div>
                ${isAdmin
                    ? '<span class="text-[11px] text-agri-700 bg-agri-100 px-2 py-1 rounded-full"><i class="fa-solid fa-unlock mr-1"></i>Admin mode</span>'
                    : '<span class="text-[11px] text-slate-500 bg-slate-100 px-2 py-1 rounded-full"><i class="fa-solid fa-lock mr-1"></i>Read-only as Farmer</span>'}
            </div>
            <div class="px-6 py-3">${rows}</div>
            <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-xl">
                <p id="settingsStatus" class="text-xs text-slate-500">
                    ${isAdmin ? 'Edit values then click Save to apply.' : 'Switch to Admin to edit values.'}
                </p>
                <div class="flex items-center gap-2">
                    <button id="settingsReset" class="admin-only text-sm px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">Reset defaults</button>
                    <button id="settingsSave"  class="admin-only text-sm px-3 py-1.5 rounded-lg bg-agri-600 hover:bg-agri-700 text-white font-medium">Save changes</button>
                </div>
            </div>
        </div>
    `;

    /* ---------- Wire device panel ---------- */
    const endpointInput = $('#deviceEndpoint', container);
    const intervalInput = $('#devicePollInterval', container);

    endpointInput?.addEventListener('input', () => { state.device.endpoint = endpointInput.value.trim(); });
    intervalInput?.addEventListener('input', () => {
        const v = parseInt(intervalInput.value, 10);
        if (!isNaN(v) && v >= 500) state.device.pollIntervalMs = v;
    });

    $('#deviceConnectBtn', container)?.addEventListener('click', () => {
        if (!state.device.endpoint) {
            toast('Enter an endpoint URL first', 'warning');
            return;
        }
        connectDevice();
    });
    $('#deviceDisconnectBtn', container)?.addEventListener('click', () => disconnectDevice());

    const supabaseUrlEl = $('#supabaseProjectUrl', container);
    const supabaseKeyEl = $('#supabaseAnonKey', container);
    const supabaseLimEl = $('#supabaseLogLimit', container);

    const persistSupabase = () => {
        try {
            localStorage.setItem('agrisense.supabase.url', state.supabase.projectUrl);
            localStorage.setItem('agrisense.supabase.anonKey', state.supabase.anonKey);
            localStorage.setItem('agrisense.supabase.logLimit', String(state.supabase.logLimit));
        } catch (_) { /* ignore */ }
    };

    supabaseUrlEl?.addEventListener('input', () => {
        state.supabase.projectUrl = supabaseUrlEl.value.trim();
        state.supabase.lastError = null;
        if (isAdmin) persistSupabase();
    });
    supabaseKeyEl?.addEventListener('input', () => {
        state.supabase.anonKey = supabaseKeyEl.value.trim();
        state.supabase.lastError = null;
        if (isAdmin) persistSupabase();
    });
    supabaseLimEl?.addEventListener('input', () => {
        const v = parseInt(supabaseLimEl.value, 10);
        if (!isNaN(v)) state.supabase.logLimit = Math.min(500, Math.max(1, v));
        if (isAdmin) persistSupabase();
    });
    $('#supabaseLoadBtn', container)?.addEventListener('click', () => loadSupabaseReadings());
    $('#supabaseSeedBtn', container)?.addEventListener('click', () => insertSupabaseTestRow());

    $('#geminiApiKey', container)?.addEventListener('input', () => {
        const el = $('#geminiApiKey', container);
        state.gemini.apiKey = el ? el.value.trim() : '';
        try {
            localStorage.setItem('agrisense.gemini.apiKey', state.gemini.apiKey);
        } catch (_) { /* ignore */ }
        state.aiInsights.autoFetchAttempted = false;
        state.aiInsights.geminiItems = null;
        state.aiInsights.error = null;
        renderAiInsights();
    });

    // Wire inputs
    const draft = {};
    Object.values(state.sensors).forEach(s => { draft[s.id] = { ...s.optimal }; });

    $$('[data-threshold]', container).forEach(input => {
        input.addEventListener('input', () => {
            const sid = input.dataset.threshold;
            const bound = input.dataset.bound;
            const val = parseFloat(input.value);
            if (!isNaN(val)) draft[sid][bound] = val;
        });
    });

    $('#settingsSave')?.addEventListener('click', () => {
        let invalid = false;
        Object.entries(draft).forEach(([id, d]) => {
            if (d.min >= d.max) invalid = true;
        });
        if (invalid) {
            toast('Min must be less than max', 'error');
            return;
        }
        Object.entries(draft).forEach(([id, d]) => {
            state.sensors[id].optimal = { ...d };
        });
        $('#settingsStatus').innerHTML = '<i class="fa-solid fa-circle-check text-agri-600 mr-1"></i> Saved — statuses recomputed.';
        addActivity('Sensor thresholds updated', 'info');
        toast('Thresholds saved', 'success');
        renderAll();
    });

    $('#settingsReset')?.addEventListener('click', () => {
        Object.entries(defaultThresholds).forEach(([id, def]) => {
            state.sensors[id].optimal = { ...def };
        });
        addActivity('Thresholds reset to defaults', 'info');
        toast('Defaults restored', 'info');
        renderAll();
    });

    $$('[data-reset-threshold]', container).forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = btn.dataset.resetThreshold;
            state.sensors[sid].optimal = { ...defaultThresholds[sid] };
            addActivity(`${state.sensors[sid].label} threshold reset`, 'info');
            renderAll();
        });
    });
}

function renderKpiGrid() {
    const grid = $('#kpiGrid');
    if (!grid) return;

    const data = getBarData(state.analyticsRange);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const trend = (arr) => arr[arr.length - 1] - arr[0];

    const kpis = [
        { label: 'Avg. soil moisture', value: `${avg(data.soil).toFixed(1)}%`, delta: trend(data.soil), unit: '%', invert: true },
        { label: 'Avg. temperature',   value: `${avg(data.temp).toFixed(1)}°C`, delta: trend(data.temp), unit: '°C' },
        { label: 'Avg. humidity',      value: `${avg(data.humid).toFixed(0)}%`, delta: trend(data.humid), unit: '%' },
        { label: 'Current soil',       value: `${formatNumber(state.sensors.soilMoisture.value, 0)}%`, delta: 0 },
    ];

    grid.innerHTML = kpis.map(k => {
        let trendHtml = '<p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-minus"></i> Stable</p>';
        if (Math.abs(k.delta) > 0.1) {
            const rising = k.delta > 0;
            const arrow  = rising ? 'fa-arrow-up' : 'fa-arrow-down';
            // For inverted KPIs (e.g. soil moisture), rising is good; for others, neutral/amber on decline.
            const good = k.invert ? rising : rising;
            const color = good && Math.abs(k.delta) < 5 ? 'text-agri-600' : 'text-amber-600';
            trendHtml = `<p class="text-xs ${color} mt-1"><i class="fa-solid ${arrow}"></i> ${Math.abs(k.delta).toFixed(1)}${k.unit || ''} over period</p>`;
        }
        return `
            <div class="bg-white rounded-xl border border-slate-200 shadow-card p-5">
                <p class="text-xs text-slate-500">${k.label}</p>
                <p class="text-2xl font-semibold text-slate-900 mt-1">${k.value}</p>
                ${trendHtml}
            </div>
        `;
    }).join('');
}

/** Primary model; fallbacks used if the API returns 404 for an retired model name. */
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

function normalizeSupabaseAnonKey(key) {
    const k = (key || '').trim();
    if (!k) return '';
    if (k.startsWith('sb_publishable_')) {
        throw new Error(
            'Use the anon public JWT (starts with eyJ…) from Supabase → Project Settings → API, not the publishable key.',
        );
    }
    if (!k.startsWith('eyJ')) {
        throw new Error('Anon key should be a JWT starting with eyJ…');
    }
    return k;
}

function normalizeGeminiApiKey(key) {
    const k = (key || '').trim();
    if (!k) return '';
    if (!k.startsWith('AIza')) {
        throw new Error('Gemini key should start with AIza… (from Google AI Studio).');
    }
    return k;
}

function formatSupabaseError(raw) {
    const text = String(raw || '');
    try {
        const j = JSON.parse(text);
        const msg = j.message || j.error || text;
        if (j.code === 'PGRST205' || /sensor_readings/.test(msg)) {
            return 'Table sensor_readings is missing. In Supabase → SQL Editor, run the file supabase/migrations/sensor_readings.sql from this repo, then click Load again.';
        }
        return msg;
    } catch {
        return text.slice(0, 400);
    }
}

function applySupabaseLatestToSensors() {
    const rows = state.supabase.rows;
    if (!rows.length) return 0;
    const latest = [...rows].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
    let applied = 0;
    const map = [
        ['soilMoisture', latest.soil_moisture],
        ['temperature', latest.temperature],
        ['humidity', latest.humidity],
        ['light', latest.lux],
    ];
    map.forEach(([id, v]) => {
        if (typeof v !== 'number' || isNaN(v)) return;
        const s = state.sensors[id];
        if (!s) return;
        s.value = clamp(v, s.min, s.max);
        applied++;
    });
    if (applied > 0) state.lastSync = new Date();
    return applied;
}

function buildAiTelemetryPayload() {
    return {
        crop: 'aloe vera (Greenhouse #4)',
        plant: { ageDays: state.plant.age, harvestTargetDays: state.plant.harvestAge },
        analyticsRange: state.analyticsRange,
        sensors: Object.fromEntries(
            Object.values(state.sensors).map(s => [
                s.id,
                {
                    label: s.label,
                    value: s.value,
                    unit: s.unit,
                    decimals: s.decimals,
                    optimal: s.optimal,
                    status: getStatus(s),
                },
            ]),
        ),
        device: {
            enabled: state.device.enabled,
            status: state.device.status,
            lastError: state.device.lastError,
        },
        supabase: {
            loadedRows: state.supabase.rows.length,
            recentSamples: state.supabase.rows.slice(0, 16).map(r => ({
                at: r.recorded_at,
                soil_moisture: r.soil_moisture,
                temperature: r.temperature,
                humidity: r.humidity,
                lux: r.lux,
                device_id: r.device_id,
            })),
        },
        offlineNodes: state.nodes.filter(n => !n.online).map(n => n.id),
    };
}

function buildGeminiUserPrompt() {
    const telemetry = JSON.stringify(buildAiTelemetryPayload(), null, 2);
    return `You are an expert agronomist for protected cultivation of aloe vera.

Using only the TELEMETRY JSON below, produce practical greenhouse management insights.

Rules:
- Reference specific numbers from telemetry when relevant.
- 4–8 insights. Each insight must have: priority (integer 0=informational, 1=watch, 2=concern, 3=urgent), title (max ~80 chars), detail (2–4 sentences, actionable), icon (Font Awesome 6 *solid* icon class only, e.g. fa-leaf or fa-droplet — include the fa- prefix, no "fa-solid" prefix).
- If telemetry shows optimal/stable conditions, still give at least one positive reinforcement and one monitoring suggestion.
- Output must be a single JSON object with shape: {"insights":[{"priority":0,"title":"...","detail":"...","icon":"fa-seedling"}, ...]}

TELEMETRY:
${telemetry}`;
}

function sanitizeInsightIcon(icon) {
    const raw = String(icon || '').trim();
    if (!raw || raw.length > 48 || !raw.startsWith('fa-')) return 'fa-robot';
    if (!/^fa-[a-z0-9-]+$/i.test(raw)) return 'fa-robot';
    return raw;
}

function normalizeGeminiInsightRow(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const priority = Math.min(3, Math.max(0, Number(raw.priority)));
    if (Number.isNaN(priority)) return null;
    const title = String(raw.title || '').trim().slice(0, 140);
    const detail = String(raw.detail || '').trim().slice(0, 1200);
    if (!title || !detail) return null;
    return {
        priority,
        title,
        detail,
        icon: sanitizeInsightIcon(raw.icon),
    };
}

async function fetchGeminiInsightsWithModel(apiKey, model) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
        contents: [{ role: 'user', parts: [{ text: buildGeminiUserPrompt() }] }],
        generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const rawJson = await res.text();
    let parsedOuter;
    try {
        parsedOuter = JSON.parse(rawJson);
    } catch {
        throw new Error(`Gemini HTTP ${res.status}: invalid JSON`);
    }

    if (!res.ok) {
        const msg = parsedOuter.error?.message || rawJson.slice(0, 200);
        const err = new Error(msg || `HTTP ${res.status}`);
        err.status = res.status;
        err.model = model;
        throw err;
    }

    if (parsedOuter.error) throw new Error(parsedOuter.error.message || 'Gemini error');

    const block = parsedOuter.promptFeedback?.blockReason;
    if (block) throw new Error(`Request blocked: ${block}`);

    const text = parsedOuter.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty model output');

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Model did not return valid JSON');
    }

    const arr = Array.isArray(data.insights) ? data.insights : Array.isArray(data) ? data : null;
    if (!arr) throw new Error('Missing "insights" array in JSON');

    const out = arr.map(normalizeGeminiInsightRow).filter(Boolean);
    if (out.length === 0) throw new Error('No usable insights in response');
    out.sort((a, b) => b.priority - a.priority);
    return { items: out, model };
}

function isGeminiModelRetryable(err) {
    const msg = (err.message || '').toLowerCase();
    return err.status === 404 || msg.includes('not found') || msg.includes('not supported');
}

async function fetchGeminiInsightsFromApi(apiKey) {
    const models = [...new Set(GEMINI_MODEL_FALLBACKS)];
    let lastErr;
    for (const model of models) {
        try {
            const { items } = await fetchGeminiInsightsWithModel(apiKey, model);
            return items;
        } catch (err) {
            lastErr = err;
            if (!isGeminiModelRetryable(err)) throw err;
        }
    }
    throw lastErr || new Error('Gemini request failed');
}

async function refreshAiInsights(opts = {}) {
    const silent = opts.silent === true;
    let apiKey;
    try {
        apiKey = normalizeGeminiApiKey(state.gemini.apiKey);
    } catch (err) {
        if (!silent) toast(err.message, 'warning');
        state.aiInsights.error = err.message;
        renderAiInsights();
        return;
    }

    state.aiInsights.loading = true;
    state.aiInsights.error = null;
    renderAiInsights();

    if (!apiKey) {
        state.aiInsights.loading = false;
        state.aiInsights.source = 'none';
        state.aiInsights.geminiItems = null;
        if (!silent) toast('Add your Google Gemini API key in Settings (Admin)', 'warning');
        renderAiInsights();
        return;
    }

    try {
        const items = await fetchGeminiInsightsFromApi(apiKey);
        state.aiInsights.geminiItems = items;
        state.aiInsights.source = 'gemini';
        state.aiInsights.updatedAt = new Date();
        state.aiInsights.error = null;
        if (!silent) {
            toast('AI insights updated (Google Gemini)', 'success');
            addActivity('AI insights generated with Google Gemini', 'info');
        }
    } catch (err) {
        state.aiInsights.geminiItems = null;
        state.aiInsights.source = 'heuristic';
        let msg = err.message || String(err);
        if (/quota|rate.?limit|429/i.test(msg)) {
            msg = 'Gemini quota exceeded for this model — wait a minute, check billing at Google AI Studio, or use backup analysis below.';
        }
        state.aiInsights.error = msg;
        state.aiInsights.updatedAt = new Date();
        if (!silent) toast(`Gemini failed — showing backup analysis`, 'warning');
    } finally {
        state.aiInsights.loading = false;
        renderAiInsights();
    }
}

function scheduleGeminiAutoFetchOnAnalytics() {
    const apiKey = (state.gemini.apiKey || '').trim();
    if (!apiKey) return;
    if (state.aiInsights.autoFetchAttempted) return;
    if (state.aiInsights.geminiItems?.length) return;
    state.aiInsights.autoFetchAttempted = true;
    setTimeout(() => refreshAiInsights({ silent: true }), 500);
}

const AI_INSIGHT_TONES = {
    3: { border: 'border-rose-200', bg: 'bg-rose-50', title: 'text-rose-900', detail: 'text-rose-800/90', iconBg: 'bg-rose-100', icon: 'text-rose-600' },
    2: { border: 'border-amber-200', bg: 'bg-amber-50', title: 'text-amber-900', detail: 'text-amber-800/90', iconBg: 'bg-amber-100', icon: 'text-amber-600' },
    1: { border: 'border-sky-200', bg: 'bg-sky-50', title: 'text-sky-900', detail: 'text-sky-800/90', iconBg: 'bg-sky-100', icon: 'text-sky-600' },
    0: { border: 'border-agri-200', bg: 'bg-agri-50/80', title: 'text-slate-900', detail: 'text-slate-600', iconBg: 'bg-agri-100', icon: 'text-agri-700' },
};

function buildHeuristicInsightItems() {
    const items = [];
    const add = (priority, title, detail, icon = 'fa-wand-magic-sparkles') => {
        items.push({ priority: Math.min(3, Math.max(0, priority)), title, detail, icon });
    };

    const problemSensors = Object.values(state.sensors).filter(s => getStatus(s) !== 'ok');
    if (problemSensors.length === 0) {
        add(0, 'Environmental balance looks good', 'All four sensor channels sit within your optimal ranges. Keep irrigation and climate routines steady unless conditions change.', 'fa-circle-check');
    } else {
        problemSensors.forEach(s => {
            const st = getStatus(s);
            const v = formatNumber(s.value, s.decimals);
            const u = s.unit === 'lux' ? ' lux' : s.unit;
            if (st === 'low') {
                add(2, `${s.label} is below target`, `Reading ${v}${u} vs your ${s.optimal.min}–${s.optimal.max} band — prioritize bringing this back into range.`, s.icon);
            } else {
                add(2, `${s.label} is above target`, `Reading ${v}${u} vs ${s.optimal.min}–${s.optimal.max} — intervene before it stays elevated.`, s.icon);
            }
        });
    }

    const sm = state.sensors.soilMoisture;
    const temp = state.sensors.temperature;
    const hum = state.sensors.humidity;
    if (getStatus(sm) === 'low' && getStatus(temp) === 'high') {
        add(3, 'Water stress risk', 'Dry soil with elevated heat increases vapor-pressure deficit — leaves lose water quickly. Increase irrigation or cool the canopy.', 'fa-fire-flame-curved');
    }
    if (getStatus(temp) === 'high' && getStatus(hum) === 'low') {
        add(3, 'Transpiration pressure', 'Hot, dry air pulls moisture from foliage. Pair soil care with humidity recovery (misting, wet pads) when appropriate.', 'fa-leaf');
    }

    const { age, harvestAge } = state.plant;
    if (age < harvestAge * 0.85) {
        add(0, 'Growth phase', `Crop age ~${age} days (harvest target ${harvestAge}+). Keep monitoring until the maturity window.`, 'fa-seedling');
    } else if (age >= harvestAge) {
        add(1, 'Harvest window', 'Estimated maturity reached — confirm with leaf quality before scheduling harvest.', 'fa-wheat-awn');
    }

    if (state.device.enabled) {
        if (state.device.status === 'connected') {
            add(0, 'Data source: live device', 'Insights use real telemetry from your gateway when values update — not pure simulation.', 'fa-wifi');
        } else if (state.device.status === 'error') {
            add(2, 'Live feed unavailable', `Values may be stale or simulated. Last error: ${state.device.lastError || 'unknown'}.`, 'fa-plug-circle-xmark');
        }
    }

    const rows = state.supabase.rows;
    if (rows.length >= 4) {
        const byTime = [...rows].sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        const recent = byTime.slice(0, Math.min(16, byTime.length));
        const soilVals = recent.map(r => r.soil_moisture).filter(v => typeof v === 'number' && !isNaN(v));
        if (soilVals.length >= 4) {
            const newest = soilVals[0];
            const oldest = soilVals[soilVals.length - 1];
            const d = newest - oldest;
            if (d <= -4) {
                add(2, 'Cloud trend: soil declining', `Last ${soilVals.length} Supabase samples show moisture down ~${Math.abs(d)} pts — compare with live soil on the dashboard.`, 'fa-cloud');
            } else if (d >= 4) {
                add(0, 'Cloud trend: soil recovering', 'Recent stored samples show moisture trending up — your adjustments may be taking effect.', 'fa-cloud');
            }
        }
        const temps = recent.map(r => r.temperature).filter(v => typeof v === 'number' && !isNaN(v));
        if (temps.length >= 3) {
            const tmax = Math.max(...temps);
            const tmin = Math.min(...temps);
            if (tmax - tmin > 4) {
                add(1, 'Temperature variability', `${tmax.toFixed(1)}–${tmin.toFixed(1)}°C range in recent cloud logs — review heating, vents, or shade timing.`, 'fa-temperature-half');
            }
        }
    } else if (state.supabase.projectUrl && state.supabase.anonKey && rows.length === 0 && !state.supabase.loading) {
        add(1, 'No cloud history loaded', 'Open Settings → Supabase cloud log and click Load to unlock trend-based insights.', 'fa-database');
    }

    const offline = state.nodes.filter(n => !n.online);
    if (offline.length > 0) {
        add(1, 'Coverage gap', `${offline.length} node(s) offline (${offline.map(n => n.id).join(', ')}) — stress in those zones may not show here.`, 'fa-tower-broadcast');
    }

    items.sort((a, b) => b.priority - a.priority);
    return items;
}

function renderAiInsights() {
    const list = $('#aiInsightsList');
    const meta = $('#aiInsightsMeta');
    if (!list) return;

    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const apiKey = (state.gemini.apiKey || '').trim();

    if (state.aiInsights.loading) {
        list.innerHTML = `
            <li class="rounded-xl border border-agri-200 bg-agri-50/50 p-10 text-center">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-agri-600 mb-3"></i>
                <p class="text-sm font-medium text-slate-800">Calling Google Gemini…</p>
                <p class="text-xs text-slate-500 mt-1">Generating structured insights from your telemetry.</p>
            </li>`;
        if (meta) meta.textContent = 'Contacting Google Gemini…';
        return;
    }

    let items;
    let metaLine;

    if (apiKey && state.aiInsights.geminiItems?.length > 0) {
        items = state.aiInsights.geminiItems;
        metaLine = [
            'Powered by Google Gemini',
            state.aiInsights.updatedAt ? `Updated ${formatTime(state.aiInsights.updatedAt)}` : '',
            `${items.length} insight(s)`,
        ].filter(Boolean).join(' · ');
    } else if (apiKey && state.aiInsights.error) {
        items = buildHeuristicInsightItems();
        metaLine = [
            'Google Gemini error — backup rule-based analysis',
            state.aiInsights.error.slice(0, 160),
            state.aiInsights.updatedAt ? `Updated ${formatTime(state.aiInsights.updatedAt)}` : '',
        ].join(' · ');
    } else if (apiKey && !state.aiInsights.geminiItems?.length && !state.aiInsights.error) {
        items = [];
        metaLine = 'Gemini API key set — click **Refresh analysis** to generate AI insights, or open this tab again to auto-run once.';
        list.innerHTML = `
            <li class="rounded-xl border border-sky-200 bg-sky-50/60 p-6 text-center">
                <i class="fa-brands fa-google text-2xl text-sky-600 mb-2"></i>
                <p class="text-sm font-semibold text-slate-900">Ready for AI analysis</p>
                <p class="text-xs text-slate-600 mt-2 max-w-md mx-auto">Click <strong>Refresh analysis</strong> above to send your current sensor context to Google Gemini and fill this panel.</p>
            </li>`;
        if (meta) meta.textContent = metaLine.replace(/\*\*/g, '');
        return;
    } else {
        items = [];
        metaLine = 'Add a free Google Gemini API key under Settings → AI insights (Gemini) to enable real AI.';
        list.innerHTML = `
            <li class="rounded-xl border border-amber-200 bg-amber-50/60 p-6 text-center">
                <i class="fa-solid fa-key text-2xl text-amber-600 mb-2"></i>
                <p class="text-sm font-semibold text-slate-900">Connect Google Gemini</p>
                <p class="text-xs text-slate-600 mt-2 max-w-md mx-auto">Switch to <strong>Admin</strong>, open <strong>Settings</strong>, paste your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-agri-700 font-medium underline">Google AI Studio</a>, then return here and click <strong>Refresh analysis</strong>.</p>
            </li>`;
        if (meta) meta.textContent = metaLine;
        return;
    }

    if (meta) meta.textContent = metaLine;

    list.innerHTML = items.map((it) => {
        const tone = AI_INSIGHT_TONES[it.priority] || AI_INSIGHT_TONES[0];
        return `
            <li class="rounded-xl border ${tone.border} ${tone.bg} p-4 flex gap-3 items-start">
                <div class="w-10 h-10 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0">
                    <i class="fa-solid ${it.icon} ${tone.icon}"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-semibold ${tone.title}">${esc(it.title)}</p>
                    <p class="text-xs mt-1 leading-relaxed ${tone.detail}">${esc(it.detail)}</p>
                </div>
            </li>
        `;
    }).join('');
}

function renderSidebarStats() {
    const online = state.nodes.filter(n => n.online).length;
    const el = $('#sidebarNodeCount');
    if (el) el.textContent = `${online} active sensor nodes`;
}

function renderHeader() {
    $('#lastSyncTime').textContent = formatTime(state.lastSync);
    $('#userRoleLabel').textContent = state.role === 'admin' ? 'System Administrator' : 'Field Operator';
    $('#greetingHeader').textContent = `${timeBasedGreeting()}, Julius`;
}

function renderRoleVisibility() {
    document.body.classList.toggle('role-admin',  state.role === 'admin');
    document.body.classList.toggle('role-farmer', state.role === 'farmer');
}

function renderAll() {
    renderSensorCards();
    renderPlantStatus();
    renderHarvest();
    renderRecommendations();
    renderActivity();
    renderAlerts();
    renderSensorsView();
    renderSettings();
    renderSidebarStats();
    renderHeader();
    renderRoleVisibility();
    renderConnectionIndicator();
    updateAnalyticsCharts();
}

/* ============================================================
 * 4b) IoT DEVICE CONNECTION (HTTP REST polling)
 *
 *   Expected JSON shape from the device (any subset works):
 *   {
 *     "soilMoisture": 22,    // alias: soil_moisture, soil, moisture
 *     "temperature": 28,     // alias: temp, temp_c
 *     "humidity": 65,        // alias: humid, rh
 *     "light": 14500         // alias: lux, lightIntensity, light_intensity
 *   }
 *
 *   Nested shape is also accepted, e.g.
 *     { "sensors": { "soilMoisture": { "value": 22 }, ... } }
 *
 *   The device MUST send CORS headers (Access-Control-Allow-Origin: *)
 *   or be on the same origin as this page.
 * ============================================================ */

const SENSOR_KEY_ALIASES = {
    soilMoisture: ['soilMoisture', 'soil_moisture', 'soil', 'moisture'],
    temperature:  ['temperature', 'temp', 'temp_c', 'temperatureC'],
    humidity:     ['humidity', 'humid', 'rh', 'relative_humidity'],
    light:        ['light', 'lux', 'lightIntensity', 'light_intensity'],
};

function pickValue(source, aliases) {
    for (const key of aliases) {
        const raw = source[key];
        if (raw === undefined || raw === null) continue;
        const num = typeof raw === 'object' ? Number(raw.value) : Number(raw);
        if (!isNaN(num)) return num;
    }
    return null;
}

function applyDeviceReadings(payload) {
    const root = payload && typeof payload === 'object'
        ? (payload.sensors && typeof payload.sensors === 'object' ? payload.sensors : payload)
        : {};

    let applied = 0;
    Object.entries(SENSOR_KEY_ALIASES).forEach(([sensorId, aliases]) => {
        const v = pickValue(root, aliases);
        if (v === null) return;
        const s = state.sensors[sensorId];
        s.value = clamp(v, s.min, s.max);
        applied++;
    });
    return applied;
}

async function pollDevice() {
    if (!state.device.enabled) return;
    try {
        const res = await fetch(state.device.endpoint, {
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const data = await res.json();
        const applied = applyDeviceReadings(data);
        if (applied === 0) throw new Error('No recognized sensor keys in response');

        const wasError = state.device.status !== 'connected';
        state.device.status = 'connected';
        state.device.lastError = null;
        state.device.consecutiveErrors = 0;
        state.lastSync = new Date();

        renderSensorCards();
        renderPlantStatus();
        renderRecommendations();
        renderAlerts();
        renderHeader();
        renderConnectionIndicator();
        updateAnalyticsCharts();

        if (wasError) {
            addActivity('Device connection restored', 'ok');
            toast('Live data flowing', 'success');
        }
    } catch (err) {
        state.device.consecutiveErrors++;
        state.device.lastError = err.message || String(err);
        state.device.status = state.device.consecutiveErrors > 3 ? 'error' : 'connecting';
        renderConnectionIndicator();
        renderAiInsights();

        if (state.device.consecutiveErrors === 4) {
            toast(`Device polling failing: ${state.device.lastError}`, 'warning');
            addActivity(`Device connection issues: ${state.device.lastError}`, 'warning');
        }
    }
}

function connectDevice() {
    if (state.device.enabled) return;
    state.device.enabled = true;
    state.device.status = 'connecting';
    state.device.consecutiveErrors = 0;
    state.device.lastError = null;

    try {
        localStorage.setItem('agrisense.device.endpoint', state.device.endpoint);
        localStorage.setItem('agrisense.device.pollIntervalMs', String(state.device.pollIntervalMs));
    } catch (_) { /* ignore */ }

    addActivity(`Connecting to device at ${state.device.endpoint}`, 'info');
    toast('Connecting to device…', 'info');
    renderConnectionIndicator();
    renderSettings();

    pollDevice();
    state.device.pollerId = setInterval(pollDevice, state.device.pollIntervalMs);
}

function disconnectDevice(silent = false) {
    if (!state.device.enabled) return;
    state.device.enabled = false;
    state.device.status = 'idle';
    if (state.device.pollerId) {
        clearInterval(state.device.pollerId);
        state.device.pollerId = null;
    }
    if (!silent) {
        addActivity('Disconnected from device — falling back to simulation', 'info');
        toast('Disconnected — simulation resumed', 'info');
    }
    renderConnectionIndicator();
    renderSettings();
}

async function loadSupabaseReadings() {
    const { projectUrl, logLimit } = state.supabase;
    const base = (projectUrl || '').trim().replace(/\/$/, '');
    let anonKey;
    try {
        anonKey = normalizeSupabaseAnonKey(state.supabase.anonKey);
    } catch (err) {
        toast(err.message, 'warning');
        state.supabase.lastError = err.message;
        renderSettings();
        return;
    }
    if (!base || !anonKey) {
        toast('Set Supabase project URL and anon key first', 'warning');
        return;
    }
    state.supabase.loading = true;
    state.supabase.lastError = null;
    renderSettings();

    try {
        const lim = Math.min(500, Math.max(1, Number(logLimit) || 50));
        const url = `${base}/rest/v1/sensor_readings?select=*&order=recorded_at.desc&limit=${lim}`;
        const res = await fetch(url, {
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                Accept: 'application/json',
            },
        });
        if (!res.ok) {
            const t = await res.text();
            throw new Error(formatSupabaseError(t || `HTTP ${res.status}`));
        }
        const data = await res.json();
        state.supabase.rows = Array.isArray(data) ? data : [];
        const applied = applySupabaseLatestToSensors();
        addActivity(`Loaded ${state.supabase.rows.length} cloud reading(s) from Supabase`, 'info');
        if (applied > 0) {
            addActivity(`Dashboard updated from latest cloud sample (${applied} sensor(s))`, 'ok');
        }
        toast(`Loaded ${state.supabase.rows.length} row(s)${applied ? ' · dashboard synced' : ''}`, 'success');
        if (applied > 0) {
            renderSensorCards();
            renderPlantStatus();
            renderRecommendations();
            renderAlerts();
            renderHeader();
            updateAnalyticsCharts();
        }
    } catch (err) {
        state.supabase.lastError = err.message || String(err);
        state.supabase.rows = [];
        toast(`Supabase: ${formatSupabaseError(state.supabase.lastError)}`, 'error');
    } finally {
        state.supabase.loading = false;
        renderSettings();
        renderAiInsights();
    }
}

async function insertSupabaseTestRow() {
    const base = (state.supabase.projectUrl || '').trim().replace(/\/$/, '');
    let anonKey;
    try {
        anonKey = normalizeSupabaseAnonKey(state.supabase.anonKey);
    } catch (err) {
        toast(err.message, 'warning');
        return;
    }
    if (!base || !anonKey) {
        toast('Set Supabase URL and anon key first', 'warning');
        return;
    }
    state.supabase.loading = true;
    state.supabase.lastError = null;
    renderSettings();

    const body = {
        device_id: 'agrisense-web-test',
        soil_moisture: Math.round(state.sensors.soilMoisture.value),
        temperature: state.sensors.temperature.value,
        humidity: state.sensors.humidity.value,
        lux: state.sensors.light.value,
    };

    try {
        const res = await fetch(`${base}/rest/v1/sensor_readings`, {
            method: 'POST',
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
            },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(formatSupabaseError(text || `HTTP ${res.status}`));
        toast('Test row inserted', 'success');
        addActivity('Inserted Supabase test row from web app', 'info');
        await loadSupabaseReadings();
    } catch (err) {
        state.supabase.lastError = err.message || String(err);
        toast(`Supabase insert: ${formatSupabaseError(state.supabase.lastError)}`, 'error');
    } finally {
        state.supabase.loading = false;
        renderSettings();
    }
}

function renderConnectionIndicator() {
    const label = $('#connectionLabel');
    const pulse = $('#connectionDotPulse');
    const solid = $('#connectionDotSolid');
    if (!label || !pulse || !solid) return;

    // Wipe color classes we toggle
    const colorClasses = ['bg-agri-500', 'bg-amber-400', 'bg-rose-500', 'bg-slate-400'];
    pulse.classList.remove(...colorClasses, 'live-dot');
    solid.classList.remove(...colorClasses);

    let text, color, animate;
    if (!state.device.enabled) {
        text = 'Simulated'; color = 'bg-amber-400'; animate = false;
    } else if (state.device.status === 'connected') {
        text = 'Live'; color = 'bg-agri-500'; animate = true;
    } else if (state.device.status === 'error') {
        text = 'Connection error'; color = 'bg-rose-500'; animate = false;
    } else {
        text = 'Connecting…'; color = 'bg-amber-400'; animate = true;
    }

    label.textContent = text;
    pulse.classList.add(color);
    solid.classList.add(color);
    if (animate) pulse.classList.add('live-dot');
}

/* ============================================================
 * 5) ACTIONS
 * ============================================================ */

function fluctuate(s, intensity = 1) {
    const range = (s.max - s.min) * 0.015 * intensity;
    const delta = (Math.random() - 0.5) * 2 * range;
    s.value = clamp(s.value + delta, s.min, s.max);
}

function refreshSensors() {
    const btn = $('#refreshBtn');
    const icon = btn?.querySelector('i');
    if (btn) btn.disabled = true;
    icon?.classList.add('fa-spin');

    setTimeout(() => {
        Object.values(state.sensors).forEach(s => fluctuate(s, 0.8));
        // Light tends to be high during day, simulate
        state.lastSync = new Date();
        icon?.classList.remove('fa-spin');
        if (btn) btn.disabled = false;
        addActivity('Manual refresh completed', 'info');
        toast('Sensor data refreshed', 'success');
        renderAll();
    }, 700);
}

function activateIrrigation() {
    if (state.irrigation.active) return;
    state.irrigation.active = true;
    state.dismissedAlerts.delete('soilMoisture');
    addActivity('Irrigation system activated', 'info');
    toast('Irrigation started', 'info');
    renderRecommendations();

    const targetMin = state.sensors.soilMoisture.optimal.min;
    const target = targetMin + 8;

    const ticker = setInterval(() => {
        const s = state.sensors.soilMoisture;
        const remaining = target - s.value;
        if (remaining <= 0.3) {
            clearInterval(ticker);
            state.irrigation.active = false;
            addActivity(`Irrigation complete — moisture at ${formatNumber(s.value, 0)}%`, 'ok');
            toast('Irrigation cycle complete', 'success');
            renderAll();
            return;
        }
        s.value = clamp(s.value + Math.max(0.6, remaining * 0.25), s.min, s.max);
        renderSensorCards();
        renderPlantStatus();
        renderAlerts();
    }, 500);
}

function simulateAction(rec) {
    const sensor = state.sensors[rec.sensorId];
    if (!sensor) return;
    const opt = sensor.optimal;
    const target = (opt.min + opt.max) / 2;
    const ticker = setInterval(() => {
        const diff = target - sensor.value;
        if (Math.abs(diff) < 0.3) {
            clearInterval(ticker);
            addActivity(`${rec.action.label} cycle complete`, 'ok');
            toast(`${rec.action.label} complete`, 'success');
            renderAll();
            return;
        }
        sensor.value = clamp(sensor.value + diff * 0.15, sensor.min, sensor.max);
        renderSensorCards();
        renderPlantStatus();
        renderAlerts();
        renderRecommendations();
    }, 450);
    addActivity(`${rec.action.label} engaged`, 'info');
    toast(`${rec.action.label}`, 'info');
}

function exportReport() {
    const report = {
        generatedAt: new Date().toISOString(),
        operator: 'Julius San Jose',
        role: state.role,
        greenhouse: 'Greenhouse #4',
        sensors: Object.values(state.sensors).map(s => ({
            label: s.label,
            value: s.value,
            unit: s.unit,
            optimal: s.optimal,
            status: getStatus(s),
        })),
        plant: state.plant,
        nodes: state.nodes,
        recentActivity: state.activity.slice(0, 15),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agrisense-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addActivity('Report exported (JSON)', 'info');
    toast('Report downloaded', 'success');
}

function setRole(role) {
    state.role = role;
    $$('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.role === role));
    renderRoleVisibility();
    renderSettings();
    renderSensorsView();
    renderHeader();
    toast(`Switched to ${role === 'admin' ? 'Admin' : 'Farmer'} role`, 'info');
}

/* ============================================================
 * 6) VIEW ROUTER
 * ============================================================ */
const viewMeta = {
    dashboard: { title: 'Dashboard', subtitle: 'Real-time overview of your aloe vera crop' },
    sensors:   { title: 'Sensors',   subtitle: 'Diagnostics for all connected nodes' },
    alerts:    { title: 'Alerts',    subtitle: 'Triggered warnings and notifications' },
    analytics: { title: 'Analytics', subtitle: "Insights and trends across your crop's vital signs" },
    settings:  { title: 'Settings',  subtitle: 'Configure thresholds and preferences' },
};

function setActiveView(viewName) {
    if (!viewMeta[viewName]) viewName = 'dashboard';
    $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === viewName));
    $$('.view').forEach(section => section.classList.toggle('active', section.id === `view-${viewName}`));
    $('#pageTitle').textContent    = viewMeta[viewName].title;
    $('#pageSubtitle').textContent = viewMeta[viewName].subtitle;
    if (viewName === 'analytics') {
        initChartsIfNeeded();
        scheduleGeminiAutoFetchOnAnalytics();
    }
}

/* ============================================================
 * 7) CHARTS
 * ============================================================ */
let radarChart, barChart;

function computeRadarData() {
    const s = state.sensors;
    const scoreFor = (sensor) => {
        const v = sensor.value;
        const { min, max } = sensor.optimal;
        if (v >= min && v <= max) return 88 + Math.random() * 6;
        if (v < min)  return clamp((v / min) * 75, 25, 80);
        return clamp((max / v) * 75, 25, 80);
    };
    return [
        78, // nutrients (placeholder until that sensor exists)
        scoreFor(s.temperature),
        scoreFor(s.humidity),
        scoreFor(s.light),
        scoreFor(s.soilMoisture),
    ];
}

function initChartsIfNeeded() {
    if (!radarChart) initRadarChart();
    if (!barChart)   initBarChart();
    updateAnalyticsCharts();
}

function initRadarChart() {
    const canvas = document.getElementById('radarChart');
    if (!canvas || typeof Chart === 'undefined') return;
    radarChart = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['Nutrients', 'Temperature', 'Humidity', 'Light', 'Soil'],
            datasets: [
                {
                    label: 'Current',
                    data: computeRadarData(),
                    backgroundColor: 'rgba(52, 150, 88, 0.18)',
                    borderColor: '#349658', borderWidth: 2,
                    pointBackgroundColor: '#349658', pointRadius: 4,
                },
                {
                    label: 'Optimal target',
                    data: [85, 90, 80, 85, 80],
                    backgroundColor: 'rgba(148, 163, 184, 0.12)',
                    borderColor: '#94a3b8', borderWidth: 1.5,
                    borderDash: [4, 4],
                    pointBackgroundColor: '#94a3b8', pointRadius: 3,
                },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, color: '#475569', boxWidth: 12 } } },
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: '#94a3b8', backdropColor: 'transparent', font: { size: 10 } },
                    grid: { color: '#e2e8f0' }, angleLines: { color: '#e2e8f0' },
                    pointLabels: { color: '#475569', font: { size: 12, weight: '500' } },
                },
            },
        },
    });
}

function getBarData(range) {
    if (range === '30d') return {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        soil:  [28, 26, 24, 22],
        temp:  [27, 27, 28, 28],
        humid: [58, 61, 63, 65],
    };
    if (range === 'season') return {
        labels: ['Mar', 'Apr', 'May'],
        soil:  [32, 27, 23],
        temp:  [24, 27, 29],
        humid: [55, 60, 64],
    };
    return {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        soil:  [26, 24, 23, 22, 20, 19, 18],
        temp:  [27, 28, 29, 28, 27, 28, 28],
        humid: [60, 62, 64, 65, 63, 66, 65],
    };
}

function initBarChart() {
    const canvas = document.getElementById('barChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const data = getBarData(state.analyticsRange);
    barChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Soil moisture (%)', data: data.soil,  backgroundColor: '#349658', borderRadius: 6, maxBarThickness: 22 },
                { label: 'Temperature (°C)',   data: data.temp,  backgroundColor: '#f59e0b', borderRadius: 6, maxBarThickness: 22 },
                { label: 'Humidity (%)',       data: data.humid, backgroundColor: '#38bdf8', borderRadius: 6, maxBarThickness: 22 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', titleFont: { size: 12 }, bodyFont: { size: 12 }, padding: 10, cornerRadius: 8 },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 11 } } },
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
            },
        },
    });
}

function updateAnalyticsCharts() {
    if (radarChart) {
        radarChart.data.datasets[0].data = computeRadarData();
        radarChart.update('none');
    }
    if (barChart) {
        const data = getBarData(state.analyticsRange);
        barChart.data.labels = data.labels;
        barChart.data.datasets[0].data = data.soil;
        barChart.data.datasets[1].data = data.temp;
        barChart.data.datasets[2].data = data.humid;
        barChart.update();
    }
    renderKpiGrid();
    renderAiInsights();
}

/* ============================================================
 * 8) LIVE SIMULATION
 * ============================================================ */
function simulationTick() {
    // If a real device is connected, it owns the readings — don't fight it.
    if (state.device.enabled && state.device.status === 'connected') return;

    Object.values(state.sensors).forEach(s => {
        if (s.id === 'soilMoisture' && !state.irrigation.active) {
            // Soil moisture trends down very slightly over time
            s.value = clamp(s.value + (Math.random() - 0.7) * 0.6, s.min, s.max);
        } else {
            fluctuate(s, 0.5);
        }
    });
    state.lastSync = new Date();

    // Clear dismissed alerts when sensor returns to ok
    Object.values(state.sensors).forEach(s => {
        if (getStatus(s) === 'ok') state.dismissedAlerts.delete(s.id);
    });

    renderSensorCards();
    renderPlantStatus();
    renderRecommendations();
    renderAlerts();
    renderHeader();
    updateAnalyticsCharts();
}

/* ============================================================
 * 9) BOOTSTRAP
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

    // Nav links
    $$('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            setActiveView(link.dataset.view);
        });
    });

    // Role toggle
    $$('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => setRole(btn.dataset.role));
    });

    // Header actions
    $('#refreshBtn')?.addEventListener('click', refreshSensors);
    $('#exportBtn')?.addEventListener('click', exportReport);
    $('#manageDevicesBtn')?.addEventListener('click', () => setActiveView('sensors'));

    // Activity clear
    $('#clearActivityBtn')?.addEventListener('click', () => {
        state.activity = [];
        renderActivity();
        toast('Activity log cleared', 'info');
    });

    // Analytics range select
    $('#analyticsRange')?.addEventListener('change', (e) => {
        state.analyticsRange = e.target.value;
        updateAnalyticsCharts();
        addActivity(`Analytics range set to ${e.target.selectedOptions[0].textContent}`, 'info');
    });

    $('#aiInsightsRefreshBtn')?.addEventListener('click', () => {
        refreshAiInsights({ silent: false });
    });

    // Initial paint
    renderAll();
    setActiveView('dashboard');

    // Live simulation
    setInterval(simulationTick, 8000);
});
