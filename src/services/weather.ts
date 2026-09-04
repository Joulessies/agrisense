const API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export interface CurrentWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  city: string;
  country: string;
}

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  description: string;
  icon: string;
  pop: number;
  rainMm: number;
  uvIndex: number;
}

export interface WeatherSummary {
  drySeasonTrend: boolean;
  consecutiveDryDays: number;
  rainExpectedDays: number;
  totalRainExpectedMm: number;
  maxUpcomingTemp: number;
  minUpcomingTemp: number;
  heatStressDays: number;
  coldStressDays: number;
  highUvDays: number;
}

export interface WeatherLocation {
  name: string;
  country: string;
  lat: number;
  lon: number;
  region?: string;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  summary: WeatherSummary;
  location: WeatherLocation;
  fetchedAt: number;
}

export const PHILIPPINES_FARM_LOCATIONS: WeatherLocation[] = [
  { name: 'Manila', country: 'PH', lat: 14.5995, lon: 120.9842, region: 'NCR / Central Luzon' },
  { name: 'Benguet (La Trinidad)', country: 'PH', lat: 16.4560, lon: 120.5872, region: 'Cordillera Highlands (Cool)' },
  { name: 'Tagaytay', country: 'PH', lat: 14.1153, lon: 120.9621, region: 'Cavite Highlands' },
  { name: 'Nueva Ecija (Cabanatuan)', country: 'PH', lat: 15.4865, lon: 120.9734, region: 'Central Luzon Plains' },
  { name: 'Bukidnon (Malaybalay)', country: 'PH', lat: 8.1575, lon: 125.1278, region: 'Northern Mindanao' },
  { name: 'Davao City', country: 'PH', lat: 7.1907, lon: 125.4504, region: 'Davao Region' },
  { name: 'Batangas City', country: 'PH', lat: 13.7565, lon: 121.0583, region: 'CALABARZON' },
  { name: 'Cebu City', country: 'PH', lat: 10.3157, lon: 123.8854, region: 'Central Visayas' },
];

export function isWeatherConfigured() {
  return Boolean(API_KEY && !API_KEY.includes('YOUR_'));
}

function wmoCodeToWeather(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Clear sky', icon: '01d' };
  if (code === 1) return { description: 'Mainly clear', icon: '02d' };
  if (code === 2) return { description: 'Partly cloudy', icon: '03d' };
  if (code === 3) return { description: 'Overcast', icon: '04d' };
  if (code === 45 || code === 48) return { description: 'Foggy', icon: '50d' };
  if (code >= 51 && code <= 55) return { description: 'Drizzle', icon: '09d' };
  if (code >= 61 && code <= 65) return { description: 'Rain', icon: '10d' };
  if (code >= 80 && code <= 82) return { description: 'Rain showers', icon: '09d' };
  if (code >= 95) return { description: 'Thunderstorm', icon: '11d' };
  return { description: 'Partly cloudy', icon: '02d' };
}

export async function fetchWeather(lat: number, lon: number, locationName?: string): Promise<WeatherData> {
  const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=auto`;

  let currentData: CurrentWeather | null = null;
  let cityName = locationName || 'Farm Location';
  let countryCode = 'PH';

  if (isWeatherConfigured()) {
    try {
      const currentRes = await fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`);
      if (currentRes.ok) {
        const c = await currentRes.json();
        cityName = locationName || c.name || cityName;
        countryCode = c.sys?.country || countryCode;
        currentData = {
          temp: Math.round(c.main.temp),
          feelsLike: Math.round(c.main.feels_like),
          humidity: c.main.humidity,
          windSpeed: Math.round(c.wind.speed * 3.6),
          description: c.weather[0].description,
          icon: c.weather[0].icon,
          city: cityName,
          country: countryCode,
        };
      }
    } catch (e) {
      console.warn('[Weather] OpenWeather current fetch failed, using fallback:', e);
    }
  }

  let forecast: ForecastDay[] = [];
  try {
    const meteoRes = await fetch(openMeteoUrl);
    if (meteoRes.ok) {
      const mData = await meteoRes.json();
      const daily = mData.daily;
      if (daily && daily.time) {
        forecast = daily.time.map((t: string, idx: number) => {
          const code = daily.weathercode?.[idx] ?? 0;
          const { description, icon } = wmoCodeToWeather(code);
          const pop = Math.min(1, Math.max(0, (daily.precipitation_probability_max?.[idx] ?? 0) / 100));
          const rainMm = Math.round((daily.precipitation_sum?.[idx] ?? 0) * 10) / 10;
          const uvIndex = Math.round((daily.uv_index_max?.[idx] ?? 5) * 10) / 10;
          return {
            date: t,
            tempMin: Math.round(daily.temperature_2m_min?.[idx] ?? 24),
            tempMax: Math.round(daily.temperature_2m_max?.[idx] ?? 32),
            description,
            icon,
            pop,
            rainMm,
            uvIndex,
          };
        });
      }
    }
  } catch (e) {
    console.warn('[Weather] Open-Meteo daily forecast failed:', e);
  }

  if (forecast.length === 0 && isWeatherConfigured()) {
    try {
      const forecastRes = await fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=40&appid=${API_KEY}`);
      if (forecastRes.ok) {
        const forecastRaw = await forecastRes.json();
        const daysMap = new Map<string, ForecastDay>();
        for (const item of forecastRaw.list) {
          const date = new Date(item.dt * 1000);
          const key = date.toISOString().split('T')[0];
          const hour = date.getHours();
          if (!daysMap.has(key) || Math.abs(hour - 12) < 3) {
            daysMap.set(key, {
              date: key,
              tempMin: Math.round(item.main.temp_min),
              tempMax: Math.round(item.main.temp_max),
              description: item.weather[0].description,
              icon: item.weather[0].icon,
              pop: item.pop ?? 0,
              rainMm: item.rain?.['3h'] ?? 0,
              uvIndex: 7,
            });
          }
        }
        forecast = Array.from(daysMap.values()).slice(0, 7);
      }
    } catch (e) {
      console.error('[Weather] OpenWeather forecast fallback also failed:', e);
    }
  }

  if (!currentData) {
    const todayForecast = forecast[0];
    currentData = {
      temp: todayForecast ? Math.round((todayForecast.tempMax + todayForecast.tempMin) / 2) : 28,
      feelsLike: todayForecast ? todayForecast.tempMax : 30,
      humidity: 68,
      windSpeed: 12,
      description: todayForecast?.description || 'Partly cloudy',
      icon: todayForecast?.icon || '02d',
      city: cityName,
      country: countryCode,
    };
  }

  const rainExpectedDays = forecast.filter((d) => d.rainMm >= 2.0 || d.pop >= 0.5).length;
  const totalRainExpectedMm = Math.round(forecast.reduce((acc, d) => acc + d.rainMm, 0) * 10) / 10;
  let consecutiveDryDays = 0;
  for (const d of forecast) {
    if (d.rainMm < 1.0 && d.pop < 0.35) {
      consecutiveDryDays++;
    } else {
      break;
    }
  }

  const maxUpcomingTemp = forecast.length > 0 ? Math.max(...forecast.map((d) => d.tempMax)) : currentData.temp;
  const minUpcomingTemp = forecast.length > 0 ? Math.min(...forecast.map((d) => d.tempMin)) : currentData.temp;
  const heatStressDays = forecast.filter((d) => d.tempMax >= 35).length;
  const coldStressDays = forecast.filter((d) => d.tempMin <= 12).length;
  const highUvDays = forecast.filter((d) => d.uvIndex >= 8).length;

  const summary: WeatherSummary = {
    drySeasonTrend: totalRainExpectedMm < 10 && rainExpectedDays <= 1,
    consecutiveDryDays,
    rainExpectedDays,
    totalRainExpectedMm,
    maxUpcomingTemp,
    minUpcomingTemp,
    heatStressDays,
    coldStressDays,
    highUvDays,
  };

  return {
    current: currentData,
    forecast,
    summary,
    location: {
      name: cityName,
      country: countryCode,
      lat,
      lon,
    },
    fetchedAt: Date.now(),
  };
}

export async function fetchWeatherByCity(city: string): Promise<WeatherData> {
  const preset = PHILIPPINES_FARM_LOCATIONS.find((p) => p.name.toLowerCase().includes(city.toLowerCase()));
  if (preset) {
    return fetchWeather(preset.lat, preset.lon, preset.name);
  }

  if (isWeatherConfigured()) {
    try {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
      );
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo.length > 0) {
          return fetchWeather(geo[0].lat, geo[0].lon, geo[0].name);
        }
      }
    } catch (e) {
      console.warn('[Weather] Geocoding OpenWeather failed, trying Open-Meteo:', e);
    }
  }

  try {
    const omGeoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    if (omGeoRes.ok) {
      const omGeo = await omGeoRes.json();
      if (omGeo.results && omGeo.results.length > 0) {
        const r = omGeo.results[0];
        return fetchWeather(r.latitude, r.longitude, r.name);
      }
    }
  } catch (e) {
    console.error('[Weather] Open-Meteo Geocoding failed:', e);
  }

  return fetchWeather(14.5995, 120.9842, city);
}
