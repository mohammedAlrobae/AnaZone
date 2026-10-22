"use client";

import React, { useState, useRef } from "react";
import { Search, MapPin, Sparkles, X, Loader2, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

interface QuickLandmark {
  nameEn: string;
  nameAr: string;
  countryEn: string;
  countryAr: string;
  city: string;
  lat: number;
  lng: number;
  emoji: string;
}

const QUICK_LANDMARKS: QuickLandmark[] = [
  {
    nameEn: "Pyramids of Giza",
    nameAr: "أهرامات الجيزة",
    countryEn: "Egypt",
    countryAr: "مصر",
    city: "Giza",
    lat: 29.9792,
    lng: 31.1342,
    emoji: "🏜️",
  },
  {
    nameEn: "Mecca Al-Haram",
    nameAr: "المسجد الحرام، مكة",
    countryEn: "Saudi Arabia",
    countryAr: "السعودية",
    city: "Mecca",
    lat: 21.4225,
    lng: 39.8262,
    emoji: "🕋",
  },
  {
    nameEn: "Burj Khalifa, Dubai",
    nameAr: "برج خليفة، دبي",
    countryEn: "UAE",
    countryAr: "الإمارات",
    city: "Dubai",
    lat: 25.1972,
    lng: 55.2744,
    emoji: "🏙️",
  },
  {
    nameEn: "Eiffel Tower, Paris",
    nameAr: "برج إيفل، باريس",
    countryEn: "France",
    countryAr: "فرنسا",
    city: "Paris",
    lat: 48.8584,
    lng: 2.2945,
    emoji: "🗼",
  },
  {
    nameEn: "Tokyo Tower",
    nameAr: "برج طوكيو",
    countryEn: "Japan",
    countryAr: "اليابان",
    city: "Tokyo",
    lat: 35.6586,
    lng: 139.7454,
    emoji: "⛩️",
  },
  {
    nameEn: "Colosseum, Rome",
    nameAr: "كولوسيوم روما",
    countryEn: "Italy",
    countryAr: "إيطاليا",
    city: "Rome",
    lat: 41.8902,
    lng: 12.4922,
    emoji: "🏛️",
  },
  {
    nameEn: "Statue of Liberty, New York",
    nameAr: "تمثال الحرية، نيويورك",
    countryEn: "USA",
    countryAr: "أمريكا",
    city: "New York",
    lat: 40.6892,
    lng: -74.0445,
    emoji: "🗽",
  },
  {
    nameEn: "Big Ben, London",
    nameAr: "ساعة بيغ بن، لندن",
    countryEn: "UK",
    countryAr: "بريطانيا",
    city: "London",
    lat: 51.5007,
    lng: -0.1246,
    emoji: "🕰️",
  },
];

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const { language } = useI18n();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { country?: string; city?: string; town?: string; state?: string };
  }>>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectQuickLandmark = (item: QuickLandmark) => {
    if (!onLocationSelect) return;
    const name = language === "ar" ? item.nameAr : item.nameEn;
    const country = language === "ar" ? item.countryAr : item.countryEn;
    onLocationSelect({
      name,
      country,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
    });
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text.trim() || text.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
            text.trim()
          )}&limit=5&accept-language=${langParam}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowResults(true);
        }
      } catch (err) {
        console.warn("Search geocode error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleSelectSearchResult = (item: any) => {
    if (!onLocationSelect) return;
    const addr = item.address || {};
    const city = addr.city || addr.town || addr.village || addr.state || "";
    const country = addr.country || "";
    const cleanName = item.display_name.split(",").slice(0, 2).join(",").trim();

    onLocationSelect({
      name: cleanName || item.display_name,
      country,
      city,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });

    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* Real Google Maps 3D Live Engine: 100% interactive, mouse pointer is the explorer with zero obstructions */}
      <div className="relative w-full h-full bg-black overflow-hidden select-none pointer-events-auto">
        <iframe
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>

      {/* Floating Aeronautical HUD Overlay: pointer-events-none container so dragging the globe everywhere works 100% */}
      <div className="absolute inset-0 pointer-events-none z-20 p-4 sm:p-6 flex flex-col justify-between">
        {/* Top Floating Place Selector Bar */}
        <div className="w-full max-w-xl flex flex-col gap-2">
          {/* Glass Search Input */}
          <div className="relative pointer-events-auto w-full">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/20 text-white shadow-2xl focus-within:border-cyan-400 transition-all">
              <Search className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResults(true);
                }}
                placeholder={
                  language === "ar"
                    ? "ابحث عن أي مدينة أو معلم لتحدث الرفيق عنها..."
                    : "Search any city or landmark to talk with agent..."
                }
                className="bg-transparent border-0 outline-none text-xs sm:text-sm text-white placeholder-white/50 w-full font-normal"
              />
              {isSearching && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
              {searchQuery && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setShowResults(false);
                  }}
                  className="p-1 rounded-full text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Search Suggestions Dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-zinc-900/95 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden shadow-2xl z-30 max-h-60 overflow-y-auto">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left rtl:text-right px-4 py-2.5 text-xs sm:text-sm text-white hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors flex items-center gap-2 border-b border-white/5 last:border-0 cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Destination Pills Carousel */}
          <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <span className="text-[11px] font-medium text-white/70 whitespace-nowrap px-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {language === "ar" ? "وجهات سريعة:" : "Explore:"}
            </span>
            {QUICK_LANDMARKS.map((item, idx) => {
              const label = language === "ar" ? item.nameAr : item.nameEn;
              const isCurrent =
                selectedLocation &&
                (selectedLocation.name.includes(item.city) ||
                  selectedLocation.name.includes(item.nameEn) ||
                  selectedLocation.name.includes(item.nameAr));

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectQuickLandmark(item)}
                  className={`pointer-events-auto px-2.5 py-1 rounded-full text-xs font-normal whitespace-nowrap transition-all flex items-center gap-1.5 shadow-md border cursor-pointer ${
                    isCurrent
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white font-medium shadow-cyan-500/30 scale-105"
                      : "bg-black/70 hover:bg-white/20 border-white/15 text-white/90 hover:text-white backdrop-blur-md"
                  }`}
                >
                  <span>{item.emoji}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Floating Active Location Indicator */}
        {selectedLocation && (
          <div className="pointer-events-auto self-start bg-black/80 backdrop-blur-md border border-cyan-500/40 rounded-xl px-4 py-2.5 text-white shadow-2xl flex items-center gap-3 animate-fade-in max-w-md">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 shrink-0 border border-cyan-400/30">
              <MapPin className="w-4 h-4" />
              {isExploring && (
                <span className="absolute inset-0 rounded-full border border-cyan-400 animate-ping opacity-75" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-cyan-300 font-medium flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                <span>
                  {isExploring
                    ? language === "ar"
                      ? "جارٍ استدعاء الشرح المباشر والطقس..."
                      : "Briefing agent on place & weather..."
                    : language === "ar"
                    ? "الموقع النشط في المحادثة"
                    : "Active in Voice Chat"}
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
