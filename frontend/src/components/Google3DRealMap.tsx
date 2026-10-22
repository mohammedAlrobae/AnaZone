"use client";

import React, { useState, useRef, useCallback } from "react";
import { Target, Globe2, Loader2, MapPin } from "lucide-react";
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
  const [mode, setMode] = useState<"explore" | "orbit">("explore");
  const [activePin, setActivePin] = useState<{ x: number; y: number; title: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Handle clicking on any place on the 3D Earth
  const handleMapClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "explore" || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const percentX = (clickX / rect.width) * 100;
      const percentY = (clickY / rect.height) * 100;

      // Calculate spherical coordinates relative to the centered Earth globe
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const globeRadius = Math.min(rect.width, rect.height) * 0.42;

      const dx = (clickX - cx) / globeRadius;
      const dy = (clickY - cy) / globeRadius;
      const distSq = dx * dx + dy * dy;

      let estimatedLat = 25.0;
      let estimatedLng = 35.0;

      if (distSq <= 1.05) {
        const clampedDy = Math.max(-1, Math.min(1, dy));
        estimatedLat = -clampedDy * 85;
        const dz = Math.sqrt(Math.max(0, 1 - distSq));
        estimatedLng = (Math.atan2(dx, dz) * (180 / Math.PI)) + 30;
        while (estimatedLng > 180) estimatedLng -= 360;
        while (estimatedLng < -180) estimatedLng += 360;
      }

      const initialTitle = language === "ar" ? "جارٍ الاستكشاف..." : "Exploring...";
      setActivePin({ x: percentX, y: percentY, title: initialTitle });

      let locationName = `${Math.abs(estimatedLat).toFixed(1)}°${estimatedLat >= 0 ? "N" : "S"}, ${Math.abs(estimatedLng).toFixed(1)}°${estimatedLng >= 0 ? "E" : "W"}`;
      let country = "";
      let city = "";

      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${estimatedLat.toFixed(
            4
          )}&lon=${estimatedLng.toFixed(4)}&format=json&accept-language=${langParam}`,
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
        console.warn("Geocoding notice:", err);
      }

      setActivePin({ x: percentX, y: percentY, title: locationName });

      if (onLocationSelect) {
        onLocationSelect({
          name: locationName,
          country,
          city,
          lat: parseFloat(estimatedLat.toFixed(4)),
          lng: parseFloat(estimatedLng.toFixed(4)),
        });
      }
    },
    [language, mode, onLocationSelect]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-black select-none"
    >
      {/* 1. Real Google Maps 3D Live Engine: Clean Orbital Planet Earth */}
      <div
        className={`absolute inset-0 w-full h-full bg-black overflow-hidden ${
          mode === "orbit" ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <iframe
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[210px] left-0 w-full h-[calc(100%+420px)] border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* Top-left dark shield to completely hide any third-party artifact from the iframe */}
      <div className="absolute top-0 left-0 w-80 h-28 bg-gradient-to-br from-black via-black/80 to-transparent pointer-events-none z-10" />

      {/* 2. Interactive Click Layer (Captures clicks anywhere on the globe) */}
      <div
        onClick={handleMapClick}
        className={`absolute inset-0 w-full h-full z-15 ${
          mode === "explore"
            ? "cursor-crosshair pointer-events-auto"
            : "pointer-events-none"
        }`}
      >
        {/* Subtle Dropped Pin at Click Location */}
        {activePin && (
          <div
            style={{ left: `${activePin.x}%`, top: `${activePin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 animate-in fade-in zoom-in-75"
          >
            <span className="absolute -inset-3 rounded-full border border-white/60 bg-white/10 animate-ping" />
            <div className="relative w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
              <MapPin className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2.5 py-0.5 rounded-full bg-black/90 border border-white/20 text-[11px] font-medium text-white whitespace-nowrap shadow-xl">
              {activePin.title}
            </div>
          </div>
        )}
      </div>

      {/* 3. Single Minimal Floating Toggle (Explore on Click vs Orbit & Spin) */}
      <div className="absolute top-4 left-4 z-25 pointer-events-auto">
        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-full border border-white/15 shadow-xl text-xs">
          <button
            type="button"
            onClick={() => setMode("explore")}
            className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "explore"
                ? "bg-white text-black shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
            title={language === "ar" ? "انقر على أي مكان على الخريطة" : "Click anywhere on Earth"}
          >
            <Target className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "استكشاف بالنقر" : "Click to Explore"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("orbit")}
            className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "orbit"
                ? "bg-white text-black shadow-sm"
                : "text-white/70 hover:text-white"
            }`}
            title={language === "ar" ? "تدوير الكرة الأرضية بالماوس" : "Drag to spin the 3D globe"}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "تدوير الكرة 3D" : "Rotate 3D"}</span>
          </button>
        </div>
      </div>

      {/* 4. Exploring Notice Badge */}
      {isExploring && (
        <div className="absolute top-4 right-4 z-25 bg-black/85 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 text-xs font-normal animate-pulse pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
          <span>
            {language === "ar" ? "جارٍ الاستماع للشرح..." : "Agent is briefing you..."}
          </span>
        </div>
      )}
    </div>
  );
}
