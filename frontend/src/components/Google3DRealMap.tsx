"use client";

import React, { useState } from "react";
import { Globe2, Sparkles, Navigation, Layers, Compass, Maximize2, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const { language } = useI18n();
  const [key, setKey] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string>("earth");

  // Reload the real 3D map frame
  const handleReload = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full relative overflow-hidden text-white flex flex-col bg-black select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center justify-end gap-3 pointer-events-none">
        {/* Right: Quick Controls & Reload */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Helpful Navigation Guidance Pill */}
          <div className="hidden md:flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[11px] text-white/80">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {language === "ar"
                ? "عجلة الفأرة للتقريب/الإبعاد بين كوكب الأرض والمباني • الزر الأيمن لإمالة الزاوية 3D"
                : "Scroll to zoom between Planet Earth & 3D buildings • Right-drag to tilt 3D angle"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleReload}
            title={language === "ar" ? "إعادة تحميل الخريطة" : "Reload Map"}
            className="p-2 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/15 text-white/80 hover:text-white transition-all shadow-lg"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real Google Maps 3D Live Engine (from official Google Maps Platform showcase) */}
      <div className="relative flex-1 w-full min-h-0 bg-black">
        <iframe
          key={key}
          src="https://com-maps-js-api.web.app/london.html"
          title="Google Maps Photorealistic 3D Planet Earth"
          className="w-full h-full border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* Slim HUD Bottom Bar (Authentic Google Maps Watermark Area & Status) */}
      <div className="w-full bg-[#0a1120] border-t border-white/10 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-white shrink-0 z-10">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          <Globe2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-white/70 font-normal">
            {language === "ar" ? "العرض الحي:" : "Active 3D Engine:"}
          </span>
          <span className="font-mono text-cyan-300 font-medium">
            {language === "ar"
              ? "كوكب الأرض ثلاثي الأبعاد والمدن المجسمة (Google 3D)"
              : "Google Photorealistic 3D Globe & Cities"}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-white/60">
          <span>{language === "ar" ? "بيانات حية من Google Maps Platform" : "Live data powered by Google Maps Platform"}</span>
        </div>
      </div>
    </div>
  );
}
