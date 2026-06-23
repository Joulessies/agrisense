// OpenWeatherMap API service
// Docs: https://openweathermap.org/api/one-call-3

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
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: ForecastDay[];
  fetchedAt: number;
}

export function isWeatherConfigured() {
  return Boolean(API_KEY && !API_KEY.includes('YOUR_'));
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=24&appid=${API_KEY}`),
  ]);

  if (!currentRes.ok) throw new Error('Failed to fetch current weather');
  if (!forecastRes.ok) throw new Error('Failed to fetch forecast');

  const current = await currentRes.json();
  const forecastRaw = await forecastRes.json();

  const days = new Map<string, ForecastDay>();
  for (const item of forecastRaw.list) {
    const date = new Date(item.dt * 1000);
    const key = date.toISOString().split('T')[0];
    const hour = date.getHours();
    if (!days.has(key) || Math.abs(hour - 12) < Math.abs(new Date((days.get(key) as ForecastDay & { _dt: number })._dt * 1000).getHours() - 12)) {
      days.set(key, {
        date: key,
        tempMin: item.main.temp_min,
        tempMax: item.main.temp_max,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        pop: item.pop,
        _dt: item.dt,
      } as ForecastDay & { _dt: number });
    }
  }

  const forecast = Array.from(days.values()).slice(0, 3).map(({ ...rest }) => {
    delete (rest as any)._dt;
    return rest as ForecastDay;
  });

  return {
    current: {
      temp: Math.round(current.main.temp),
      feelsLike: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      windSpeed: Math.round(current.wind.speed * 3.6), // m/s -> km/h
      description: current.weather[0].description,
      icon: current.weather[0].icon,
      city: current.name,
      country: current.sys.country,
    },
    forecast,
    fetchedAt: Date.now(),
  };
}

export async function fetchWeatherByCity(city: string): Promise<WeatherData> {
  const geoRes = await fetch(
    `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
  );
  const geo = await geoRes.json();
  if (!geo.length) throw new Error(`City "${city}" not found`);
  return fetchWeather(geo[0].lat, geo[0].lon);
}
