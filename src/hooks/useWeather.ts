'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchWeather, fetchWeatherByCity, WeatherData, isWeatherConfigured } from '@/services/weather';

const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_WEATHER_CITY ?? 'Manila';

interface UseWeatherReturn {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useWeather(): UseWeatherReturn {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<WeatherData | null>(null);

  const load = useCallback(async () => {
    if (!isWeatherConfigured()) {
      setError('OpenWeatherMap API key not configured');
      return;
    }

    if (cacheRef.current && Date.now() - cacheRef.current.fetchedAt < CACHE_TTL_MS) {
      setWeather(cacheRef.current);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data: WeatherData;

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        data = await new Promise<WeatherData>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                resolve(await fetchWeather(pos.coords.latitude, pos.coords.longitude));
              } catch (e) {
                reject(e);
              }
            },
            async () => {
              try {
                resolve(await fetchWeatherByCity(DEFAULT_CITY));
              } catch (e) {
                reject(e);
              }
            },
            { timeout: 5000 }
          );
        });
      } else {
        data = await fetchWeatherByCity(DEFAULT_CITY);
      }

      cacheRef.current = data;
      setWeather(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch weather');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { weather, isLoading, error, refresh: load };
}
