'use client';

import { useState, useCallback } from 'react';

export interface GeminiInsight {
  title: string;
  body: string;
  type: 'tip' | 'warning' | 'ok';
}

interface UseGeminiInsightsReturn {
  insights: GeminiInsight[];
  isLoading: boolean;
  error: string | null;
  refresh: (sensorData: Record<string, { value: number; unit: string; optimal: { min: number; max: number } }>) => Promise<void>;
}

export function useGeminiInsights(): UseGeminiInsightsReturn {
  const [insights, setInsights] = useState<GeminiInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (sensorData: Record<string, { value: number; unit: string; optimal: { min: number; max: number } }>) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/gemini-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensors: sensorData }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load insights';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { insights, isLoading, error, refresh };
}
