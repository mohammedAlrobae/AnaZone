"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const [exploringName, setExploringName] = useState<string | null>(null);

  // Listen for real 3D clicks from the Google 3D Earth engine
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "ANAZONE_MAP_3D_CLICK") {
        const { lat, lng } = event.data;
        if (typeof lat !== "number" || typeof lng !== "number") return;

        setExploringName(language === "ar" ? "جارٍ تحديد الموقع..." : "Locating place...");

        let locationName = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
        let country = "";
        let city = "";

        try {
          const langParam = language === "ar" ? "ar,en" : "en";
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(
              4
            )}&lon=${lng.toFixed(4)}&format=json&accept-language=${langParam}`,
            { headers: { "User-Agent": "AnaZone/1.0" } }
          );

          if (res.ok) {
            const data = await res.json();
            if (data) {
              const addr = data.address || {};
              country = addr.country || "";
              city = addr.city || addr.town || addr.village || addr.state || "";
              locationName =
                data.name ||
                city ||
                addr.tourism ||
                addr.historic ||
                data.display_name?.split(",")[0] ||
                locationName;
            }
          }
        } catch (err) {
          console.warn("Reverse geocode notice:", err);
        }

        setExploringName(locationName);

        if (onLocationSelect) {
          onLocationSelect({
            name: locationName,
            country,
            city,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [language, onLocationSelect]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* Real Google Maps 3D Live Engine: Fully controllable (drag, zoom, tilt, click) */}
      <iframe
        src="/google-3d.html"
        title="Google Maps Photorealistic 3D Globe"
        className="w-full h-full border-0 select-none bg-black"
        allow="geolocation; accelerometer; gyroscope"
        loading="eager"
      />

      {/* Exploring Notice Badge */}
      {(isExploring || exploringName) && (
        <div className="absolute top-4 left-4 z-20 bg-black/85 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 text-xs font-normal pointer-events-none animate-in fade-in">
          {isExploring && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
          <span>
            {exploringName || (language === "ar" ? "جارٍ تجهيز النبذة الصوتية..." : "Agent is briefing you...")}
          </span>
        </div>
      )}
    </div>
  );
}
