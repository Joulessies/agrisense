'use client';

import React, { useEffect } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { ForecastDay } from '@/services/weather';

const ICON_URL = (icon: string) => `https://openweathermap.org/img/wn/${icon}@2x.png`;

function ForecastPill({ day }: { day: ForecastDay }) {
  const date = new Date(day.date + 'T12:00:00');
  const label = date.toLocaleDateString(undefined, { weekday: 'short' });
  const rainPct = Math.round(day.pop * 100);

  return (
    <div className="flex flex-col items-center gap-1 bg-white/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/80 min-w-[72px]">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <img src={ICON_URL(day.icon)} alt={day.description} className="w-8 h-8 -my-1" />
      <p className="text-xs font-bold text-slate-800">{day.tempMax}°</p>
      <p className="text-[10px] text-slate-400">{day.tempMin}°</p>
      {rainPct > 20 && (
        <p className="text-[10px] text-sky-500 font-medium">{rainPct}% 🌧</p>
      )}
    </div>
  );
}

export function WeatherCard() {
  const { weather, isLoading, error, refresh } = useWeather();

  useEffect(() => {
    refresh();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-5 text-white animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <i className="fa-solid fa-cloud-sun text-white/70"></i>
          <p className="text-sm font-semibold text-white/80">Loading weather...</p>
        </div>
        <div className="h-10 bg-white/20 rounded-lg mb-3"></div>
        <div className="h-6 bg-white/20 rounded-lg w-2/3"></div>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2 min-h-[140px]">
        <i className="fa-solid fa-cloud-slash text-slate-300 text-2xl"></i>
        <p className="text-sm font-medium text-slate-500">Weather unavailable</p>
        <p className="text-xs text-slate-400 max-w-[180px]">
          {error ?? 'Add NEXT_PUBLIC_OPENWEATHER_API_KEY to .env.local'}
        </p>
        <button
          onClick={() => refresh()}
          className="text-xs text-agri-600 hover:underline mt-1 font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  const { current, forecast } = weather;
  const rainWarning = forecast.some((d) => d.pop > 0.5);

  return (
    <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-5 text-white shadow-[0_4px_20px_-4px_rgba(14,165,233,0.4)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-sky-100 uppercase tracking-wide mb-0.5">
            <i className="fa-solid fa-location-dot mr-1"></i>
            {current.city}, {current.country}
          </p>
          <p className="text-sm font-semibold text-white capitalize">{current.description}</p>
        </div>
        <button
          onClick={() => refresh()}
          className="text-white/60 hover:text-white transition"
          title="Refresh weather"
        >
          <i className="fa-solid fa-rotate text-sm"></i>
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <img src={ICON_URL(current.icon)} alt={current.description} className="w-14 h-14 -ml-2 -my-2" />
        <div>
          <p className="text-4xl font-bold leading-none">{current.temp}°C</p>
          <p className="text-sky-100 text-xs mt-1">Feels like {current.feelsLike}°C</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-sky-100 mb-4">
        <span><i className="fa-solid fa-droplet mr-1"></i>{current.humidity}%</span>
        <span><i className="fa-solid fa-wind mr-1"></i>{current.windSpeed} km/h</span>
        {rainWarning && (
          <span className="bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
            🌧 Rain expected
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {forecast.slice(0, 3).map((day) => (
          <ForecastPill key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}
