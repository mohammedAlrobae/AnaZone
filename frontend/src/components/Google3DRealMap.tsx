"use client";

import React, { useState } from "react";
import { MapPin, Volume2, Loader2 } from "lucide-react";
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
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // When user clicks the Red Pointer Pin to select the current location
  const handleSelectLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);

    try {
      // Default exploration focal coordinates (Middle East / Egypt / Gulf)
      const lat = selectedLocation ? selectedLocation.lat : 29.9792;
      const lng = selectedLocation ? selectedLocation.lng : 31.1342;

      let locationName = language === "ar" ? "أهرامات الجيزة، مصر" : "Pyramids of Giza, Egypt";
      let country = language === "ar" ? "مصر" : "Egypt";
      let city = language === "ar" ? "الجيزة" : "Giza";

      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(
            4
          )}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            country = data.address.country || country;
            city = data.address.city || data.address.town || data.address.state || city;
            locationName = data.name || city || data.display_name?.split(",")[0] || locationName;
            if (country && !locationName.includes(country)) {
              locationName += `, ${country}`;
            }
          }
        }
      } catch (e) {
        console.warn("Geocoding notice:", e);
      }

      if (onLocationSelect) {
        onLocationSelect({
          name: locationName,
          country,
          city,
          lat,
          lng,
        });
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* 1. Real Google Maps 3D Live Engine: 100% interactive, moves freely with mouse, stable */}
      <div className="relative w-full h-full bg-black overflow-hidden select-none pointer-events-auto">
        <iframe
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* 2. THE RED ICON (Pointer Pin & Selection Badge) */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Red Pointer Pin Centered on Globe */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none">
          {/* Action Button: Click to Select Place & Talk to Agent */}
          <button
            type="button"
            onClick={handleSelectLocation}
            className="pointer-events-auto mb-2 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-[0_4px_25px_rgba(239,68,68,0.9)] border border-white/20 transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            title={language === "ar" ? "اضغط لاختيار هذا المكان والتحدث مع الرفيق" : "Click to select place and talk to agent"}
          >
            <MapPin className="w-3.5 h-3.5 text-white fill-white" />
            <span>
              {isLocating
                ? language === "ar"
                  ? "جارٍ تحديد المكان..."
                  : "Locating..."
                : language === "ar"
                ? "تحديد هذا المكان والتحدث"
                : "Select Place & Talk"}
            </span>
          </button>

          {/* Glowing Red Icon Marker with Radar Pulse */}
          <div className="relative flex flex-col items-center">
            {/* Pulsing Beacon Waves */}
            <span className="absolute -inset-2 rounded-full bg-red-500/40 animate-ping" />
            <span className="absolute -inset-4 rounded-full bg-red-600/20 animate-pulse" />

            {/* Red Pin Sphere */}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-red-500 border-2 border-white flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,1)]">
              <MapPin className="w-5 h-5 text-white fill-white" />
            </div>

            {/* Pin Pointer Stem */}
            <div className="w-1.5 h-2.5 bg-white -mt-0.5 rounded-b-full shadow-md" />
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 -mt-0.5 shadow-[0_0_15px_#ef4444]" />
          </div>

          {/* Active Place Label under the Red Pin */}
          {selectedLocation && (
            <div className="mt-2 px-3.5 py-1.5 rounded-full bg-black/90 backdrop-blur-md border border-red-500/60 text-white text-xs font-medium flex items-center gap-2 shadow-2xl animate-fade-in pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="truncate max-w-[240px]">{selectedLocation.name}</span>
              {isExploring && <Loader2 className="w-3 h-3 text-red-400 animate-spin" />}
            </div>
          )}
        </div>

        {/* Floating Active Status HUD on Bottom-Left */}
        {selectedLocation && (
          <div className="absolute bottom-5 left-5 pointer-events-auto bg-black/85 backdrop-blur-md border border-red-500/40 rounded-xl px-4 py-2.5 text-white shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 shrink-0 border border-red-400/30">
              <MapPin className="w-4 h-4 fill-red-400" />
              {isExploring && (
                <span className="absolute inset-0 rounded-full border border-red-400 animate-ping opacity-75" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-red-300 font-medium flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                <span>
                  {isExploring
                    ? language === "ar"
                      ? "الرفيق يجهّز النبذة والطقس..."
                      : "Agent is briefing you..."
                    : language === "ar"
                    ? "المكان المحدد في المحادثة"
                    : "Selected Location"}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-white truncate">
                {selectedLocation.name}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
