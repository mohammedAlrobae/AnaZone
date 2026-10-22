"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { MapPin, Search, Target, Globe2, Loader2, Sparkles, Navigation } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

interface ActivePin {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

const PRESET_PLACES = [
  { name: "Riyadh", nameAr: "الرياض", country: "Saudi Arabia", countryAr: "السعودية", lat: 24.7136, lng: 46.6753, x: 62.9, y: 44.5, emoji: "🇸🇦" },
  { name: "Ar Rass", nameAr: "الرس", country: "Saudi Arabia", countryAr: "السعودية", lat: 25.8694, lng: 43.4975, x: 62.0, y: 43.6, emoji: "🇸🇦" },
  { name: "Mecca", nameAr: "مكة المكرمة", country: "Saudi Arabia", countryAr: "السعودية", lat: 21.4225, lng: 39.8262, x: 61.1, y: 47.1, emoji: "🕋" },
  { name: "Cairo", nameAr: "القاهرة", country: "Egypt", countryAr: "مصر", lat: 30.0444, lng: 31.2357, x: 58.7, y: 40.2, emoji: "🇪🇬" },
  { name: "Dubai", nameAr: "دبي", country: "United Arab Emirates", countryAr: "الإمارات", lat: 25.2048, lng: 55.2708, x: 65.3, y: 44.1, emoji: "🇦🇪" },
  { name: "London", nameAr: "لندن", country: "United Kingdom", countryAr: "بريطانيا", lat: 51.5074, lng: -0.1278, x: 49.9, y: 25.8, emoji: "🇬🇧" },
  { name: "Paris", nameAr: "باريس", country: "France", countryAr: "فرنسا", lat: 48.8566, lng: 2.3522, x: 50.6, y: 27.6, emoji: "🇫🇷" },
  { name: "Tokyo", nameAr: "طوكيو", country: "Japan", countryAr: "اليابان", lat: 35.6762, lng: 139.6503, x: 88.7, y: 36.4, emoji: "🇯🇵" },
];

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const { language } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Mode: "select" allows clicking anywhere to drop the Red Pointer Pin. "orbit" allows dragging Google 3D Earth.
  const [mode, setMode] = useState<"select" | "orbit">("select");
  const [activePin, setActivePin] = useState<ActivePin | null>({
    x: 62.9,
    y: 44.5,
    name: language === "ar" ? "الرياض" : "Riyadh",
    country: "Saudi Arabia",
    city: "Riyadh",
    lat: 24.7136,
    lng: 46.6753,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Sync activePin if selectedLocation is updated from outside
  useEffect(() => {
    if (selectedLocation) {
      setActivePin((prev) => {
        // If we already have coordinates, estimate X/Y percentage or keep existing
        const x = prev ? prev.x : 50;
        const y = prev ? prev.y : 50;
        return {
          x,
          y,
          name: selectedLocation.name,
          country: selectedLocation.country,
          city: selectedLocation.city,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        };
      });
    }
  }, [selectedLocation]);

  // Handle dropping the Red Pointer Pin by clicking anywhere on the map
  const handleMapClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (mode !== "select" || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const percentX = (clickX / rect.width) * 100;
      const percentY = (clickY / rect.height) * 100;

      // Coordinate mapping approximation based on globe projection
      const estimatedLng = (percentX / 100) * 360 - 180;
      const estimatedLat = 90 - (percentY / 100) * 180;

      const tempName = language === "ar" ? "جارٍ تحديد الموقع..." : "Identifying location...";

      // Optimistically drop Red Pointer Pin immediately
      setActivePin({
        x: percentX,
        y: percentY,
        name: tempName,
        country: "",
        city: "",
        lat: parseFloat(estimatedLat.toFixed(4)),
        lng: parseFloat(estimatedLng.toFixed(4)),
      });

      // Reverse geocode via OpenStreetMap Nominatim
      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${estimatedLat.toFixed(4)}&lon=${estimatedLng.toFixed(4)}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );

        let locationName = `${Math.abs(estimatedLat).toFixed(2)}°${estimatedLat >= 0 ? "N" : "S"}, ${Math.abs(estimatedLng).toFixed(2)}°${estimatedLng >= 0 ? "E" : "W"}`;
        let country = "";
        let city = "";

        if (res.ok) {
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            country = addr.country || "";
            city = addr.city || addr.town || addr.village || addr.state || "";
            locationName = data.name || city || addr.state || data.display_name?.split(",")[0] || locationName;
          }
        }

        const finalPin: ActivePin = {
          x: percentX,
          y: percentY,
          name: locationName,
          country,
          city,
          lat: parseFloat(estimatedLat.toFixed(4)),
          lng: parseFloat(estimatedLng.toFixed(4)),
        };

        setActivePin(finalPin);

        if (onLocationSelect) {
          onLocationSelect({
            name: locationName,
            country,
            city,
            lat: finalPin.lat,
            lng: finalPin.lng,
          });
        }
      } catch (err) {
        console.warn("Reverse geocode fallback:", err);
      }
    },
    [mode, language, onLocationSelect]
  );

  // Search input handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || isSearching) return;

    setIsSearching(true);
    try {
      const langParam = language === "ar" ? "ar,en" : "en";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=${langParam}`,
        { headers: { "User-Agent": "AnaZone/1.0" } }
      );

      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const parts = (item.display_name || query).split(",");
          const name = parts[0]?.trim() || query;
          const country = parts[parts.length - 1]?.trim() || "";
          const city = parts.length > 1 ? parts[1]?.trim() : "";

          // Calculate approximate screen coordinates
          const percentX = Math.max(10, Math.min(90, ((lng + 180) / 360) * 100));
          const percentY = Math.max(15, Math.min(85, ((90 - lat) / 180) * 100));

          const newPin: ActivePin = {
            x: percentX,
            y: percentY,
            name,
            country,
            city,
            lat,
            lng,
          };

          setActivePin(newPin);
          setSearchQuery("");

          if (onLocationSelect) {
            onLocationSelect({
              name,
              country,
              city,
              lat,
              lng,
            });
          }
        }
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPreset = (p: typeof PRESET_PLACES[0]) => {
    const pin: ActivePin = {
      x: p.x,
      y: p.y,
      name: language === "ar" ? p.nameAr : p.name,
      country: p.country,
      city: p.name,
      lat: p.lat,
      lng: p.lng,
    };
    setActivePin(pin);

    if (onLocationSelect) {
      onLocationSelect({
        name: pin.name,
        country: pin.country,
        city: pin.city,
        lat: pin.lat,
        lng: pin.lng,
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-black select-none"
    >
      {/* 1. Real Google Maps 3D Live Engine: Orbital Planet Earth Globe */}
      <div
        className={`absolute inset-0 w-full h-full bg-black overflow-hidden ${
          mode === "orbit" ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <iframe
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* 2. Interactive Click Overlay (Active when in 'select' mode) */}
      <div
        onClick={handleMapClick}
        className={`absolute inset-0 w-full h-full z-10 transition-all ${
          mode === "select" ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Red Pointer Pin with Pulsing Radar Ripple */}
        {activePin && (
          <div
            style={{ left: `${activePin.x}%`, top: `${activePin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-30 animate-in fade-in zoom-in-75 duration-200"
          >
            {/* Ground Radar Waves (Ruby / Red Pulsing Effect) */}
            <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full border-2 border-red-500 bg-red-500/25 animate-ping" />
            <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-red-500 shadow-[0_0_15px_#ef4444]" />

            {/* Floating Pointer Badge & Marker */}
            <div className="relative flex flex-col items-center">
              {/* Tooltip Card above pin */}
              <div className="px-3 py-1 rounded-xl bg-black/90 border border-red-500/60 backdrop-blur-md shadow-[0_4px_25px_rgba(239,68,68,0.5)] flex items-center gap-1.5 whitespace-nowrap mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                <span className="text-xs font-semibold text-white tracking-wide">{activePin.name}</span>
              </div>

              {/* Red Pin Sphere */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 via-red-500 to-rose-400 border-2 border-white flex items-center justify-center shadow-[0_0_22px_rgba(239,68,68,0.9)] transform -translate-y-0.5">
                <MapPin className="w-4 h-4 text-white fill-white" />
              </div>
              {/* Pin needle point */}
              <div className="w-1.5 h-2 bg-white -mt-0.5 rounded-b-full shadow-md" />
            </div>
          </div>
        )}
      </div>

      {/* 3. Top Controls Bar: Mode Switcher & Search Bar */}
      <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 z-30 pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-xl p-1 rounded-2xl border border-white/20 shadow-2xl">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "select"
                ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title={language === "ar" ? "انقر في أي مكان على الخريطة لوضع المؤشر الأحمر" : "Click anywhere on map to drop red pointer"}
          >
            <MapPin className="w-3.5 h-3.5 text-white fill-current" />
            <span>{language === "ar" ? "تحديد بالمؤشر الأحمر" : "Select Location (Red Pin)"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("orbit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "orbit"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
            title={language === "ar" ? "تحريك وتدوير الكرة الأرضية ثلاثية الأبعاد بحرية" : "Freely orbit and zoom 3D globe"}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "دوران الكرة الأرضية 3D" : "3D Orbit Globe"}</span>
          </button>
        </div>

        {/* Right: Quick Search Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="w-full sm:w-auto flex items-center bg-black/85 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/20 shadow-2xl"
        >
          <Search className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === "ar"
                ? "ابحث عن أي مدينة في العالم..."
                : "Search any city on Earth..."
            }
            className="w-full sm:w-64 bg-transparent text-white placeholder-white/50 px-2 py-0.5 text-xs outline-none border-none"
            dir="auto"
          />
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin shrink-0" />
          ) : (
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-red-600/80 hover:bg-red-600 disabled:opacity-40 text-white cursor-pointer transition-colors"
            >
              {language === "ar" ? "تحديد" : "Pin"}
            </button>
          )}
        </form>
      </div>

      {/* 4. Bottom Preset Destination Chips */}
      <div className="absolute bottom-6 left-4 sm:left-6 right-20 sm:right-32 z-30 pointer-events-auto overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-white/60 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shrink-0">
            {language === "ar" ? "تحديد سريع:" : "Quick Pin:"}
          </span>
          {PRESET_PLACES.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className="px-3 py-1 rounded-full bg-black/80 hover:bg-zinc-900 text-white/90 hover:text-white border border-white/15 hover:border-red-500/50 backdrop-blur-md text-xs font-normal transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <span>{p.emoji}</span>
              <span>{language === "ar" ? p.nameAr : p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Exploring Indicator Badge */}
      {isExploring && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-xl border border-white/20 text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-xs font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>
            {language === "ar"
              ? "الوكيل يجهز نبذة صوتية ممتعة عن الموقع..."
              : "Agent is briefing you about this location..."}
          </span>
        </div>
      )}
    </div>
  );
}
