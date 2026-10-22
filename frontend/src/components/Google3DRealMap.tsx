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
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // When user clicks the original red pin to select the location
  const handleSelectLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);

    try {
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
      {/* 1. Real Google Maps 3D Live Engine: 100% interactive, moves freely with mouse pointer */}
      <div className="relative w-full h-full bg-black overflow-hidden select-none pointer-events-auto">
        <iframe
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* 2. Just the original red pin pointer */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-20 pointer-events-none flex flex-col items-center">
        <button
          type="button"
          onClick={handleSelectLocation}
          className="pointer-events-auto cursor-pointer transition-transform hover:scale-110 active:scale-90 flex flex-col items-center bg-transparent border-0 p-0 outline-none"
          title={language === "ar" ? "اضغط لاختيار هذا المكان والتحدث مع الرفيق" : "Click to select location & talk to agent"}
        >
          {/* Clean Original Red Pin */}
          <div className="w-7 h-7 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-[0_2px_10px_rgba(239,68,68,0.8)]">
            <MapPin className="w-4 h-4 text-white fill-white" />
          </div>
          {/* Pin needle point */}
          <div className="w-1.5 h-2.5 bg-white -mt-0.5 rounded-b-full shadow-sm" />
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 -mt-0.5 shadow-[0_0_8px_#ef4444]" />
        </button>
      </div>
    </div>
  );
}
