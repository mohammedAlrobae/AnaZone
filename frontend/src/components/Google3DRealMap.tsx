"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Search,
  Sparkles,
  MapPin,
  Target,
  Globe2,
  Navigation,
  Loader2,
  Volume2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

interface Landmark {
  id: string;
  name: string;
  nameAr: string;
  country: string;
  countryAr: string;
  city: string;
  cityAr: string;
  lat: number;
  lng: number;
  emoji: string;
  posX: number; // % x in container
  posY: number; // % y in container
}

const LANDMARKS: Landmark[] = [
  {
    id: "giza",
    name: "Pyramids of Giza",
    nameAr: "أهرامات الجيزة",
    country: "Egypt",
    countryAr: "مصر",
    city: "Giza",
    cityAr: "الجيزة",
    lat: 29.9792,
    lng: 31.1342,
    emoji: "🏜️",
    posX: 52.5,
    posY: 44.0,
  },
  {
    id: "mecca",
    name: "Holy Kaaba, Mecca",
    nameAr: "الكعبة المشرفة، مكة",
    country: "Saudi Arabia",
    countryAr: "السعودية",
    city: "Mecca",
    cityAr: "مكة المكرمة",
    lat: 21.4225,
    lng: 39.8262,
    emoji: "🕋",
    posX: 56.5,
    posY: 49.0,
  },
  {
    id: "petra",
    name: "Petra Ancient City",
    nameAr: "مدينة البتراء الأثرية",
    country: "Jordan",
    countryAr: "الأردن",
    city: "Wadi Musa",
    cityAr: "وادي موسى",
    lat: 30.3285,
    lng: 35.4444,
    emoji: "🏛️",
    posX: 54.5,
    posY: 43.0,
  },
  {
    id: "dubai",
    name: "Burj Khalifa",
    nameAr: "برج خليفة",
    country: "United Arab Emirates",
    countryAr: "الإمارات",
    city: "Dubai",
    cityAr: "دبي",
    lat: 25.1972,
    lng: 55.2744,
    emoji: "🏙️",
    posX: 61.0,
    posY: 46.5,
  },
  {
    id: "jerusalem",
    name: "Al-Aqsa Mosque",
    nameAr: "المسجد الأقصى المبارك",
    country: "Palestine",
    countryAr: "فلسطين",
    city: "Jerusalem",
    cityAr: "القدس الشريف",
    lat: 31.7761,
    lng: 35.2358,
    emoji: "🕌",
    posX: 53.5,
    posY: 42.0,
  },
  {
    id: "paris",
    name: "Eiffel Tower",
    nameAr: "برج إيفل",
    country: "France",
    countryAr: "فرنسا",
    city: "Paris",
    cityAr: "باريس",
    lat: 48.8584,
    lng: 2.2945,
    emoji: "🗼",
    posX: 44.0,
    posY: 33.5,
  },
  {
    id: "rome",
    name: "The Colosseum",
    nameAr: "مدرج الكولوسيوم",
    country: "Italy",
    countryAr: "إيطاليا",
    city: "Rome",
    cityAr: "روما",
    lat: 41.8902,
    lng: 12.4922,
    emoji: "🏛️",
    posX: 47.5,
    posY: 37.0,
  },
  {
    id: "london",
    name: "Big Ben & Westminster",
    nameAr: "ساعة بيغ بن",
    country: "United Kingdom",
    countryAr: "بريطانيا",
    city: "London",
    cityAr: "لندن",
    lat: 51.5007,
    lng: -0.1246,
    emoji: "🇬🇧",
    posX: 42.0,
    posY: 30.0,
  },
  {
    id: "istanbul",
    name: "Hagia Sophia",
    nameAr: "آيا صوفيا",
    country: "Turkey",
    countryAr: "تركيا",
    city: "Istanbul",
    cityAr: "إسطنبول",
    lat: 41.0086,
    lng: 28.9802,
    emoji: "🕌",
    posX: 51.0,
    posY: 37.5,
  },
  {
    id: "tokyo",
    name: "Mount Fuji & Tokyo",
    nameAr: "جبل فوجي وطوكيو",
    country: "Japan",
    countryAr: "اليابان",
    city: "Tokyo",
    cityAr: "طوكيو",
    lat: 35.3606,
    lng: 138.7274,
    emoji: "⛩️",
    posX: 79.0,
    posY: 41.0,
  },
  {
    id: "newyork",
    name: "Times Square & Manhattan",
    nameAr: "تايمز سكوير ومانهاتن",
    country: "USA",
    countryAr: "الولايات المتحدة",
    city: "New York",
    cityAr: "نيويورك",
    lat: 40.7580,
    lng: -73.9855,
    emoji: "🗽",
    posX: 24.0,
    posY: 37.0,
  },
  {
    id: "rio",
    name: "Christ the Redeemer",
    nameAr: "تمثال المسيح الفادي",
    country: "Brazil",
    countryAr: "البرازيل",
    city: "Rio de Janeiro",
    cityAr: "ريو دي جانيرو",
    lat: -22.9519,
    lng: -43.2105,
    emoji: "🇧🇷",
    posX: 34.0,
    posY: 68.0,
  },
  {
    id: "tajmahal",
    name: "Taj Mahal",
    nameAr: "تاج محل",
    country: "India",
    countryAr: "الهند",
    city: "Agra",
    cityAr: "أغرا",
    lat: 27.1751,
    lng: 78.0421,
    emoji: "🕌",
    posX: 67.0,
    posY: 45.5,
  },
  {
    id: "beijing",
    name: "Great Wall of China",
    nameAr: "سور الصين العظيم",
    country: "China",
    countryAr: "الصين",
    city: "Beijing",
    cityAr: "بكين",
    lat: 40.4319,
    lng: 116.5704,
    emoji: "🇨🇳",
    posX: 74.5,
    posY: 38.5,
  },
  {
    id: "sydney",
    name: "Sydney Opera House",
    nameAr: "دار أوبرا سيدني",
    country: "Australia",
    countryAr: "أستراليا",
    city: "Sydney",
    cityAr: "سيدني",
    lat: -33.8568,
    lng: 151.2153,
    emoji: "🇦🇺",
    posX: 82.5,
    posY: 72.0,
  },
  {
    id: "marrakech",
    name: "Marrakech Medina",
    nameAr: "مدينة مراكش العتيقة",
    country: "Morocco",
    countryAr: "المغرب",
    city: "Marrakech",
    cityAr: "مراكش",
    lat: 31.6295,
    lng: -7.9811,
    emoji: "🇲🇦",
    posX: 38.5,
    posY: 43.5,
  },
];

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const { language } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [mode, setMode] = useState<"explore" | "orbit">("explore");
  const [activePin, setActivePin] = useState<{ x: number; y: number; title: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Trigger location exploration
  const triggerLocation = useCallback(
    (loc: LocationSelected, screenPos?: { x: number; y: number }) => {
      if (screenPos) {
        setActivePin({
          x: screenPos.x,
          y: screenPos.y,
          title: loc.name,
        });
      }
      if (onLocationSelect) {
        onLocationSelect(loc);
      }
    },
    [onLocationSelect]
  );

  // Handle direct click on any Landmark beacon
  const handleLandmarkClick = (lm: Landmark, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = language === "ar" ? lm.nameAr : lm.name;
    const country = language === "ar" ? lm.countryAr : lm.country;
    const city = language === "ar" ? lm.cityAr : lm.city;

    triggerLocation(
      {
        name,
        country,
        city,
        lat: lm.lat,
        lng: lm.lng,
      },
      { x: lm.posX, y: lm.posY }
    );
  };

  // Handle direct click on the 3D globe canvas
  const handleGlobeClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "explore" || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = (clickX / rect.width) * 100;
    const percentY = (clickY / rect.height) * 100;

    // Approximate lat / lng based on spherical projection of centered Earth globe
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const globeRadius = Math.min(rect.width, rect.height) * 0.40;

    const dx = (clickX - cx) / globeRadius;
    const dy = (clickY - cy) / globeRadius;
    const distSq = dx * dx + dy * dy;

    // Estimate coordinates
    let estimatedLat = 25.0;
    let estimatedLng = 35.0;

    if (distSq <= 1.05) {
      const clampedDy = Math.max(-1, Math.min(1, dy));
      estimatedLat = -clampedDy * 80; // Latitude degrees [-80, 80]
      const dz = Math.sqrt(Math.max(0, 1 - distSq));
      estimatedLng = (Math.atan2(dx, dz) * (180 / Math.PI)) + 30; // Center longitude ~30°E
      while (estimatedLng > 180) estimatedLng -= 360;
      while (estimatedLng < -180) estimatedLng += 360;
    }

    setActivePin({
      x: percentX,
      y: percentY,
      title: language === "ar" ? "جارٍ تحديد الموقع..." : "Locating...",
    });

    try {
      // Reverse geocode via Nominatim
      const langParam = language === "ar" ? "ar,en" : "en";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${estimatedLat.toFixed(
          4
        )}&lon=${estimatedLng.toFixed(4)}&format=json&accept-language=${langParam}`,
        { headers: { "User-Agent": "AnaZone/1.0" } }
      );

      let placeName = `${estimatedLat.toFixed(1)}°, ${estimatedLng.toFixed(1)}°`;
      let country = "";
      let city = "";

      if (res.ok) {
        const data = await res.json();
        if (data) {
          const addr = data.address || {};
          country = addr.country || "";
          city = addr.city || addr.town || addr.state || "";
          placeName =
            data.name ||
            city ||
            addr.tourism ||
            addr.historic ||
            data.display_name?.split(",")[0] ||
            placeName;
        }
      }

      triggerLocation(
        {
          name: placeName,
          country,
          city,
          lat: estimatedLat,
          lng: estimatedLng,
        },
        { x: percentX, y: percentY }
      );
    } catch {
      // Fallback
      triggerLocation(
        {
          name: `${estimatedLat.toFixed(1)}°, ${estimatedLng.toFixed(1)}°`,
          country: "",
          city: "",
          lat: estimatedLat,
          lng: estimatedLng,
        },
        { x: percentX, y: percentY }
      );
    }
  };

  // Search input handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query || isSearching) return;

    setIsSearching(true);
    try {
      const langParam = language === "ar" ? "ar,en" : "en";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1&accept-language=${langParam}`,
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

          triggerLocation(
            {
              name,
              country,
              city,
              lat,
              lng,
            },
            { x: 50, y: 50 }
          );
          setSearchQuery("");
        }
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
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
          className="absolute -top-[160px] left-0 w-full h-[calc(100%+320px)] border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* 2. Interactive Click-to-Explore Overlay (Captures clicks anywhere on map) */}
      <div
        onClick={handleGlobeClick}
        className={`absolute inset-0 w-full h-full z-10 transition-all ${
          mode === "explore"
            ? "cursor-crosshair pointer-events-auto"
            : "pointer-events-none"
        }`}
      >
        {/* Landmark Hotspots: Pulsing radar pins directly over key places */}
        {LANDMARKS.map((lm) => {
          const isSelected =
            selectedLocation &&
            selectedLocation.name.toLowerCase().includes(lm.name.toLowerCase());

          return (
            <div
              key={lm.id}
              onClick={(e) => handleLandmarkClick(lm, e)}
              style={{ left: `${lm.posX}%`, top: `${lm.posY}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20 pointer-events-auto"
            >
              {/* Radar ping ripple animation */}
              <span
                className={`absolute -inset-2 rounded-full border opacity-75 animate-ping pointer-events-none ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-400/20"
                    : "border-white/50 bg-white/10"
                }`}
              />

              {/* Pin core button */}
              <button
                type="button"
                className={`relative w-6 h-6 rounded-full flex items-center justify-center border shadow-lg transition-transform duration-200 group-hover:scale-125 ${
                  isSelected
                    ? "bg-emerald-500 border-white text-white shadow-[0_0_15px_#10b981]"
                    : "bg-black/85 hover:bg-black border-white/60 text-white"
                }`}
                title={language === "ar" ? lm.nameAr : lm.name}
              >
                <span className="text-[10px]">{lm.emoji}</span>
              </button>

              {/* Tooltip Card on Hover */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-30 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-1 rounded-lg bg-black/90 border border-white/20 backdrop-blur-md shadow-2xl text-center whitespace-nowrap">
                  <p className="text-xs font-medium text-white flex items-center gap-1">
                    <span>{lm.emoji}</span>
                    <span>{language === "ar" ? lm.nameAr : lm.name}</span>
                  </p>
                  <p className="text-[10px] text-white/60">
                    {language === "ar" ? lm.countryAr : lm.country} •{" "}
                    <span className="text-emerald-400">
                      {language === "ar" ? "انقر للاستماع" : "Click to hear"}
                    </span>
                  </p>
                </div>
                <div className="w-1.5 h-1.5 rotate-45 bg-black border-r border-b border-white/20 -mt-1" />
              </div>
            </div>
          );
        })}

        {/* Active Dropped Pin (User Clicked Arbitrary Location) */}
        {activePin && (
          <div
            style={{ left: `${activePin.x}%`, top: `${activePin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-25 animate-in fade-in zoom-in-75"
          >
            <span className="absolute -inset-4 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping" />
            <div className="relative w-7 h-7 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center shadow-[0_0_20px_#06b6d4]">
              <MapPin className="w-4 h-4 text-black" />
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2.5 py-1 rounded-md bg-black/90 border border-white/20 text-[11px] font-medium text-white whitespace-nowrap shadow-xl">
              {activePin.title}
            </div>
          </div>
        )}
      </div>

      {/* 3. Top Floating Exploration & Control Panel */}
      <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 z-30 pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-xl p-1 rounded-2xl border border-white/15 shadow-2xl">
          <button
            type="button"
            onClick={() => setMode("explore")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "explore"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "استكشاف بالنقر" : "Click to Explore"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("orbit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "orbit"
                ? "bg-white text-black shadow-md font-semibold"
                : "text-white/70 hover:text-white hover:bg-white/10"
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "دوران الكرة الأرضية 3D" : "3D Orbit Globe"}</span>
          </button>
        </div>

        {/* Center / Right: Quick Search Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="w-full sm:w-auto flex items-center bg-black/85 backdrop-blur-xl px-3 py-1.5 rounded-2xl border border-white/15 shadow-2xl"
        >
          <Search className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === "ar"
                ? "ابحث عن أي مدينة أو معلم في العالم..."
                : "Search any city or landmark on Earth..."
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
              className="text-[11px] px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-40 text-white cursor-pointer transition-colors"
            >
              {language === "ar" ? "بحث" : "Go"}
            </button>
          )}
        </form>
      </div>

      {/* 4. Bottom Floating Quick Destination Chips */}
      <div className="absolute bottom-6 left-4 sm:left-6 right-20 sm:right-32 z-30 pointer-events-auto overflow-x-auto no-scrollbar py-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-white/60 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shrink-0">
            {language === "ar" ? "وجهات سريعة:" : "Explore:"}
          </span>
          {LANDMARKS.slice(0, 8).map((lm) => (
            <button
              key={lm.id}
              type="button"
              onClick={(e) => handleLandmarkClick(lm, e)}
              className="px-3 py-1 rounded-full bg-black/80 hover:bg-black text-white/90 hover:text-white border border-white/15 hover:border-white/40 backdrop-blur-md text-xs font-normal transition-all shrink-0 cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95"
            >
              <span>{lm.emoji}</span>
              <span>{language === "ar" ? lm.nameAr : lm.name}</span>
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
