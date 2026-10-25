'use client';

import React, { useState, useEffect } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { ForecastDay, PHILIPPINES_FARM_LOCATIONS, WeatherLocation } from '@/services/weather';

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
  const { weather, isLoading, isDetectingLocation, isGpsLocated, error, refresh, setLocation, detectAndApplyLocation } = useWeather();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const handleSelectPreset = (loc: WeatherLocation) => {
    setLocation(loc);
    setShowLocationModal(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCity.trim()) return;
    setIsSearching(true);
    await refresh(searchCity.trim());
    setIsSearching(false);
    setShowLocationModal(false);
    setSearchCity('');
  };

  if (isLoading || isDetectingLocation) {
    return (
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-5 text-white animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-location-crosshairs text-white/70 animate-spin"></i>
            <p className="text-sm font-semibold text-white/80">
              {isDetectingLocation ? 'Pinpointing real-time location…' : 'Fetching live weather…'}
            </p>
          </div>
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
          {error ?? 'Failed to retrieve live forecast'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => detectAndApplyLocation(true)}
            className="text-xs bg-sky-600 text-white font-medium px-2.5 py-1 rounded-lg hover:bg-sky-700 transition cursor-pointer"
          >
            Detect My Location
          </button>
          <button
            onClick={() => refresh()}
            className="text-xs text-slate-600 hover:underline font-medium cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { current, forecast } = weather;
  const rainWarning = forecast.some((d) => d.pop > 0.5);

  return (
    <>
      <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl p-5 text-white shadow-[0_4px_20px_-4px_rgba(14,165,233,0.4)] relative overflow-hidden">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="text-xs font-semibold text-sky-100 hover:text-white uppercase tracking-wide flex items-center gap-1 hover:underline cursor-pointer group"
                title="Click to change farm city or search Zambales / Quezon City"
              >
                <i className="fa-solid fa-location-dot group-hover:scale-110 transition-transform"></i>
                <span>{current.city}, {current.country}</span>
                <i className="fa-solid fa-chevron-down text-[9px] opacity-70 ml-0.5"></i>
              </button>
              {isGpsLocated && (
                <span className="text-[9px] bg-emerald-400/25 border border-emerald-300/40 text-emerald-100 font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-300 animate-ping"></span>
                  Live GPS
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white capitalize mt-0.5">{current.description}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Search city / Change location"
            >
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </button>
            <button
              type="button"
              onClick={() => detectAndApplyLocation(true)}
              disabled={isDetectingLocation}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Locate my exact position in real time"
            >
              <i className={`fa-solid fa-location-crosshairs text-xs ${isDetectingLocation ? 'animate-spin' : ''}`}></i>
            </button>
            <button
              type="button"
              onClick={() => refresh()}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Refresh live weather"
            >
              <i className="fa-solid fa-rotate text-xs"></i>
            </button>
          </div>
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

      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                  <i className="fa-solid fa-location-dot text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Select Farm Location</h3>
                  <p className="text-[11px] text-slate-500">Pick or search Philippine farm microclimate</p>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    placeholder="Search city (e.g. Quezon City, Zambales, Iba)..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchCity.trim()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                >
                  {isSearching ? <i className="fa-solid fa-rotate animate-spin"></i> : "Search"}
                </button>
              </form>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Featured Farm Hubs (Including Zambales & QC)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {PHILIPPINES_FARM_LOCATIONS.map((loc) => {
                    const isSelected = current.city.toLowerCase().includes(loc.name.toLowerCase().split(' ')[0]);
                    return (
                      <button
                        key={loc.name}
                        onClick={() => handleSelectPreset(loc)}
                        className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? "bg-sky-50/80 border-sky-500 text-sky-950 font-bold ring-1 ring-sky-500/30"
                            : "bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300"
                        }`}
                      >
                        <span className="flex items-center justify-between">
                          <span className="font-semibold">{loc.name}</span>
                          {isSelected && <i className="fa-solid fa-circle-check text-sky-600 text-xs"></i>}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal mt-0.5 truncate">{loc.region}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    detectAndApplyLocation(true);
                    setShowLocationModal(false);
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <i className="fa-solid fa-location-crosshairs text-xs"></i>
                  Use exact GPS location
                </button>
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
