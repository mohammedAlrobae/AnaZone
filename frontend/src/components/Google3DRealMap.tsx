"use client";

import React, { useState } from "react";
import { MapPin } from "lucide-react";
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
  const [key] = useState<number>(0);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // When user clicks the Red Pointer to select the location currently pointed to
  const handleSelectLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);

    try {
      // Default center coordinates of the 3D globe view (Middle East / Saudi Arabia centered)
      const lat = 24.7136;
      const lng = 46.6753;

      let locationName = language === "ar" ? "الرياض، المملكة العربية السعودية" : "Riyadh, Saudi Arabia";
      let country = "Saudi Arabia";
      let city = "Riyadh";

      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            country = data.address.country || country;
            city = data.address.city || data.address.town || data.address.state || city;
            locationName = data.name || city || data.display_name?.split(",")[0] || locationName;
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
      {/* 1. Real Google Maps 3D Live Engine: 100% interactive, moves freely with mouse */}
      <div className="relative w-full h-full bg-black overflow-hidden select-none pointer-events-auto">
        <iframe
          key={key}
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* 2. Red Pointer Pin: Centered, pointer-events-none so it NEVER blocks map movement */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none flex flex-col items-center">
        {/* Action Button to Select Pointed Place */}
        <button
          type="button"
          onClick={handleSelectLocation}
          className="pointer-events-auto mb-2 px-3.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-[0_4px_20px_rgba(239,68,68,0.7)] border border-white/20 transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          title={language === "ar" ? "تحديد الموقع الذي يشير إليه المؤشر" : "Select location pointed to"}
        >
          <MapPin className="w-3.5 h-3.5 text-white fill-current" />
          <span>
            {isLocating
              ? (language === "ar" ? "جارٍ التحديد..." : "Selecting...")
              : (language === "ar" ? "تحديد هذا الموقع" : "Select Location")}
          </span>
        </button>

        {/* Glowing Red Pin Marker */}
        <div className="relative flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 border-2 border-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.9)]">
            <MapPin className="w-4 h-4 text-white fill-white" />
          </div>
          <div className="w-1.5 h-2 bg-white -mt-0.5 rounded-b-full shadow-md" />
          <span className="w-3 h-3 rounded-full bg-red-500 -mt-0.5 shadow-[0_0_12px_#ef4444]" />
        </div>
      </div>
    </div>
  );
}
