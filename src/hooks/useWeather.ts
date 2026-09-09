'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWeather, fetchWeatherByCity, detectUserLocation, WeatherData, WeatherLocation } from '@/services/weather';
import { useStore } from '@/store/useStore';

const CACHE_TTL_MS = 3 * 60 * 1000;

interface UseWeatherReturn {
  weather: WeatherData | null;
  isLoading: boolean;
  isDetectingLocation: boolean;
  isGpsLocated: boolean;
  error: string | null;
  refresh: (overrideLocation?: WeatherLocation | string) => Promise<WeatherData | null>;
  setLocation: (location: WeatherLocation) => void;
  detectAndApplyLocation: (forceGpsPrompt?: boolean) => Promise<WeatherData | null>;
}

export function useWeather(): UseWeatherReturn {
  const { farmLocation, setFarmLocation } = useStore();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isGpsLocated, setIsGpsLocated] = useState<boolean>(Boolean(farmLocation.isGps));
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, WeatherData>>(new Map());
  const hasAutoDetected = useRef(false);

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

  const detectAndApplyLocation = useCallback(
    async (forceGpsPrompt = true): Promise<WeatherData | null> => {
      setIsDetectingLocation(true);
      try {
        const detected = await detectUserLocation();
        const withGpsFlag = { ...detected, isGps: true };
        setIsGpsLocated(true);
        setFarmLocation(withGpsFlag);
        const freshWeather = await refresh(withGpsFlag);
        return freshWeather;
      } catch {
        return null;
      } finally {
        setIsDetectingLocation(false);
      }
    },
    [setFarmLocation, refresh]
  );

  useEffect(() => {
    refresh();
  }, [farmLocation.lat, farmLocation.lon]);

  useEffect(() => {
    if (!hasAutoDetected.current && typeof window !== 'undefined') {
      hasAutoDetected.current = true;
      if (!localStorage.getItem('agrisense_detected_location')) {
        detectAndApplyLocation(false);
      }
    }
  }, [detectAndApplyLocation]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const setLocation = useCallback(
    (loc: WeatherLocation) => {
      setIsGpsLocated(Boolean(loc.isGps));
      setFarmLocation(loc);
      refresh(loc);
    },
    [setFarmLocation, refresh]
  );

  return {
    weather,
    isLoading,
    isDetectingLocation,
    isGpsLocated,
    error,
    refresh,
    setLocation,
    detectAndApplyLocation,
  };
}
