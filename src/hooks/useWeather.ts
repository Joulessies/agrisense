'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWeather, fetchWeatherByCity, WeatherData, WeatherLocation } from '@/services/weather';
import { useStore } from '@/store/useStore';

const CACHE_TTL_MS = 5 * 60 * 1000;

interface UseWeatherReturn {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refresh: (overrideLocation?: WeatherLocation | string) => Promise<WeatherData | null>;
  setLocation: (location: WeatherLocation) => void;
}

export function useWeather(): UseWeatherReturn {
  const { farmLocation, setFarmLocation } = useStore();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, WeatherData>>(new Map());

  const refresh = useCallback(
    async (overrideLocation?: WeatherLocation | string): Promise<WeatherData | null> => {
      setIsLoading(true);
      setError(null);

      try {
        let data: WeatherData;
        const target = overrideLocation || farmLocation;

        if (typeof target === 'string') {
          data = await fetchWeatherByCity(target);
          if (data.location) {
            setFarmLocation(data.location);
          }
        } else {
          const cacheKey = `${target.lat.toFixed(3)},${target.lon.toFixed(3)}`;
          const cached = cacheRef.current.get(cacheKey);
          if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
            setWeather(cached);
            setIsLoading(false);
            return cached;
          }

          data = await fetchWeather(target.lat, target.lon, target.name);
          cacheRef.current.set(cacheKey, data);
        }

        setWeather(data);
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch weather';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [farmLocation, setFarmLocation]
  );

  useEffect(() => {
    refresh();
  }, [farmLocation.lat, farmLocation.lon]);

  const setLocation = useCallback(
    (loc: WeatherLocation) => {
      setFarmLocation(loc);
      refresh(loc);
    },
    [setFarmLocation, refresh]
  );

  return { weather, isLoading, error, refresh, setLocation };
}

