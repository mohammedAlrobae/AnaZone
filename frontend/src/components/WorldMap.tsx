"use client";

import React, { useState } from "react";
import { Globe2, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import PlanetEarth3D from "./PlanetEarth3D";
import GoogleMaps3D from "./GoogleMaps3D";

export interface LocationSelected {
  name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
}

interface WorldMapProps {
  onLocationSelect: (loc: LocationSelected) => void;
  selectedLocation: LocationSelected | null;
  isExploring?: boolean;
}

export default function WorldMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: WorldMapProps) {
  const { language } = useI18n();
  // Default to 3D Planet Earth engine, with one-click toggle to Google Maps 3D Platform
  const [engine, setEngine] = useState<"planet" | "google3d">("planet");

  return (
    <div className="w-full h-full min-h-0 rounded-2xl relative overflow-hidden text-white flex flex-col shadow-2xl border border-white/10 bg-[#040810]">
      {/* Top Floating Engine Switcher Capsule */}
      <div className="absolute top-3 left-3 z-30 flex items-center bg-black/70 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-2xl text-xs">
        <button
          type="button"
          onClick={() => setEngine("planet")}
          className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
            engine === "planet"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/50"
              : "text-white/70 hover:text-white"
          }`}
        >
          <Globe2 className="w-3.5 h-3.5 text-cyan-300" />
          <span>{language === "ar" ? "كوكب الأرض 3D" : "3D Planet Earth"}</span>
        </button>

        <button
          type="button"
          onClick={() => setEngine("google3d")}
          className={`px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
            engine === "google3d"
              ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/50"
              : "text-white/70 hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <span>{language === "ar" ? "خرائط غوغل 3D (GA)" : "Google 3D Maps (GA)"}</span>
        </button>
      </div>

      {/* Main Map Viewport */}
      <div className="relative flex-1 w-full min-h-0">
        {engine === "planet" ? (
          <PlanetEarth3D
            onLocationSelect={onLocationSelect}
            selectedLocation={selectedLocation}
            isExploring={isExploring}
          />
        ) : (
          <GoogleMaps3D
            onLocationSelect={onLocationSelect}
            selectedLocation={selectedLocation}
            isExploring={isExploring}
          />
        )}
      </div>
    </div>
  );
}
