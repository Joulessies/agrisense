"use client";

import React from "react";

interface AloeCareMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AloeCareMatrixModal({ isOpen, onClose }: AloeCareMatrixModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200/80">
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-agri-700 via-agri-600 to-emerald-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
              <i className="fa-solid fa-seedling text-white text-lg"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white leading-none">Aloe Barbadensis Miller</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-emerald-100">
                  Scientific Matrix
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Curated Agronomic Guidelines & Biological Standards for Greenhouse & Container Cultivation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-slate-700 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider mb-1">
                <i className="fa-solid fa-dna text-emerald-600"></i> Photosynthetic Pathway
              </div>
              <p className="text-sm font-semibold text-emerald-950">CAM (Crassulacean Acid)</p>
              <p className="text-xs text-emerald-700/90 mt-1 leading-relaxed">
                Stomata open only at night to absorb CO2, minimizing daylight water evaporation by up to 90%.
              </p>
            </div>

            <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-xs uppercase tracking-wider mb-1">
                <i className="fa-solid fa-droplet text-blue-600"></i> Irrigation Strategy
              </div>
              <p className="text-sm font-semibold text-blue-950">"Soak and Dry" Protocol</p>
              <p className="text-xs text-blue-700/90 mt-1 leading-relaxed">
                Thoroughly water root zone, then allow substrate to thoroughly desiccate before subsequent irrigation.
              </p>
            </div>

            <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider mb-1">
                <i className="fa-solid fa-flask-vial text-amber-600"></i> Soil & Substrate pH
              </div>
              <p className="text-sm font-semibold text-amber-950">6.0 — 7.2 (Porous Loam)</p>
              <p className="text-xs text-amber-700/90 mt-1 leading-relaxed">
                Fast-draining gritty mix (sand, perlite, pumice) to preclude stagnant standing water around crowns.
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-agri-600"></i> Standard Thresholds & Physiological Limits
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-agri-300 transition shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-droplet"></i>
                    </span>
                    <span className="font-bold text-slate-900">Soil Moisture Content</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">15% — 35%</span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 mt-2">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] mt-0.5"></i>
                    <span><strong>Sweet Spot:</strong> 20% – 30%. Keeps aloe gel thick without saturating root capillaries.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-0.5"></i>
                    <span><strong>Hazard (&gt; 45%):</strong> Vulnerable to <em>Erwinia chrysanthemi</em> soft rot &amp; root asphyxiation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-exclamation text-amber-500 text-[10px] mt-0.5"></i>
                    <span><strong>Dehydration (&lt; 15%):</strong> Leaves cup inward, thin out, and deplete gel reserves.</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-agri-300 transition shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-sun"></i>
                    </span>
                    <span className="font-bold text-slate-900">Light &amp; Illuminance</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold">20,000 — 45,000 Lux</span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 mt-2">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] mt-0.5"></i>
                    <span><strong>Optimal:</strong> Bright indirect or morning direct sun for 6–8 hours daily.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-0.5"></i>
                    <span><strong>Sunburn (&gt; 50,000 Lux):</strong> Triggers anthocyanin reddening, turning fleshy leaves brown or reddish.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-exclamation text-amber-500 text-[10px] mt-0.5"></i>
                    <span><strong>Etiolation (&lt; 10,000 Lux):</strong> Weak, pale, leggy leaf stalks prone to flopping over.</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-agri-300 transition shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-temperature-half"></i>
                    </span>
                    <span className="font-bold text-slate-900">Ambient Temperature</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold">20°C — 35°C</span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 mt-2">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] mt-0.5"></i>
                    <span><strong>Daytime Ideal:</strong> 25°C – 32°C. Excellent match for tropical &amp; subtropical greenhouses.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-0.5"></i>
                    <span><strong>Extreme Heat (&gt; 38°C):</strong> Increases respiration rate and transpirational water loss.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-exclamation text-blue-500 text-[10px] mt-0.5"></i>
                    <span><strong>Cold Shock (&lt; 10°C):</strong> Freezes cellular gel matrix, causing irreversible collapse.</span>
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-agri-300 transition shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center text-sm">
                      <i className="fa-solid fa-wind"></i>
                    </span>
                    <span className="font-bold text-slate-900">Relative Humidity</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold">40% — 65%</span>
                </div>
                <ul className="text-xs space-y-1.5 text-slate-600 mt-2">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-500 text-[10px] mt-0.5"></i>
                    <span><strong>Target:</strong> Moderate humidity with steady laminar ventilation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-0.5"></i>
                    <span><strong>High Humidity (&gt; 75%):</strong> Promotes fungal leaf spots (<em>Alternaria</em>) and rust.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-info text-slate-400 text-[10px] mt-0.5"></i>
                    <span><strong>Tip:</strong> Ensure exhaust fans circulate air during humid monsoon mornings.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
              <i className="fa-solid fa-stethoscope text-agri-600"></i> Visual Symptom Rapid Diagnostic
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-amber-700">Brown / Reddish Leaves</p>
                <p className="text-slate-500 mt-1">Direct sun scorch or severe dehydration. Relocate to filtered shade.</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-rose-700">Mushy / Translucent Base</p>
                <p className="text-slate-500 mt-1">Excess moisture / root rot. Cease watering immediately and aerate soil.</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-blue-700">Curled / Indented Blades</p>
                <p className="text-slate-500 mt-1">Water deficiency. Execute a deep soak cycle to replenish gel parenchyma.</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <p className="font-bold text-emerald-700">Pale / Drooping Stalks</p>
                <p className="text-slate-500 mt-1">Low light intensity. Increase exposure to at least 20,000 Lux.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">AgriSense Aloe • Agronomic Matrix v2.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
}
