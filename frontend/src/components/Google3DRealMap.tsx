"use client";

import React, { useState } from "react";
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
  const [key] = useState<number>(0);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* Real Google Maps 3D Live Engine: Orbital Planet Earth Globe with country & place labels, zero click popups */}
      <div className="relative w-full h-full bg-black overflow-hidden">
        <iframe
          key={key}
          src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
          title="Google Maps Photorealistic 3D Globe with Place Names"
          className="absolute -top-[90px] left-0 w-full h-[calc(100%+90px)] border-0 select-none"
          allow="geolocation; accelerometer; gyroscope"
          loading="eager"
        />
      </div>
    </div>
  );
}
