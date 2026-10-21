"use client";

import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
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

  // Reload the real 3D map frame
  const handleReload = () => {
    setKey((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* Discreet Reload Button in Top-Left Corner (No text, pure icon) */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={handleReload}
          title={language === "ar" ? "إعادة تحميل الخريطة" : "Reload 3D Map"}
          aria-label="Reload 3D Map"
          className="p-2.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-all shadow-xl"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Real Google Maps 3D Live Engine with HYBRID Mode (Place names, streets & countries visible, NO hotel markers) */}
      <div className="relative w-full h-full bg-black">
        <iframe
          key={key}
          src="https://maps-docs-team.web.app/samples/3d-simple-map/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="w-full h-full border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>
    </div>
  );
}
