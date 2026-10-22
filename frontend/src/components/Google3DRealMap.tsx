"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Volume2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

const GOOGLE_MAPS_KEY = "AIzaSyA6myHzS10YXdcazAFalmXvDkrYCp5cLc8";

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const { language } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const map3dElementRef = useRef<any>(null);
  const [native3DLoaded, setNative3DLoaded] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [pinScreenPos, setPinScreenPos] = useState<{ x: number; y: number } | null>(null);

  // Reverse geocoding helper
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(
            4
          )}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );

        let locationName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
        let country = "";
        let city = "";

        if (res.ok) {
          const data = await res.json();
          const address = data.address || {};
          country = address.country || "";
          city =
            address.city ||
            address.town ||
            address.village ||
            address.state ||
            address.region ||
            "";

          if (city && country) {
            locationName = `${city}, ${country}`;
          } else if (country) {
            locationName = country;
          } else if (data.display_name) {
            locationName = data.display_name.split(",").slice(0, 2).join(",").trim();
          }
        }

        return { locationName, country, city };
      } catch (err) {
        console.warn("Reverse geocode notice:", err);
        return {
          locationName: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
          country: "",
          city: "",
        };
      }
    },
    [language]
  );

  // Handle location click from native <gmp-map-3d>
  const handleMapClick = useCallback(
    async (lat: number, lng: number, clientX?: number, clientY?: number) => {
      if (isLocating) return;
      setIsLocating(true);

      if (clientX !== undefined && clientY !== undefined && mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        setPinScreenPos({ x: clientX - rect.left, y: clientY - rect.top });
      }

      try {
        const info = await reverseGeocode(lat, lng);
        if (onLocationSelect) {
          onLocationSelect({
            name: info.locationName,
            country: info.country,
            city: info.city,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
          });
        }
      } finally {
        setIsLocating(false);
      }
    },
    [isLocating, onLocationSelect, reverseGeocode]
  );

  // Initialize native Google Maps 3D with gmp-click support
  useEffect(() => {
    let isMounted = true;
    const scriptId = "google-maps-3d-native-script";

    const loadMaps3D = async () => {
      try {
        if (!(window as any).google?.maps?.importLibrary) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById(scriptId);
            if (existing) {
              existing.addEventListener("load", () => resolve());
              existing.addEventListener("error", () => reject());
              return;
            }
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&v=alpha&libraries=maps3d`;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.head.appendChild(script);
          });
        }

        if (!isMounted || !mapContainerRef.current) return;

        const { Map3DElement, Marker3DElement } = await (window as any).google.maps.importLibrary("maps3d");

        const map3d = new Map3DElement({
          center: { lat: 26.0, lng: 40.0, altitude: 15000000 },
          tilt: 0,
          range: 0,
          heading: 0,
          roll: 0,
          mode: "HYBRID",
        });

        map3d.style.width = "100%";
        map3d.style.height = "100%";

        // Native 3D Click listener on Earth
        map3d.addEventListener("gmp-click", (event: any) => {
          if (event && event.position) {
            const { lat, lng } = event.position;
            const clientX = (event.domEvent as MouseEvent)?.clientX;
            const clientY = (event.domEvent as MouseEvent)?.clientY;

            // Place 3D marker
            try {
              const marker = new Marker3DElement({
                position: { lat, lng, altitude: 200 },
                altitudeMode: "RELATIVE_TO_GROUND",
              });
              map3d.append(marker);
            } catch (_) { }

            void handleMapClick(lat, lng, clientX, clientY);
          }
        });

        if (mapContainerRef.current) {
          mapContainerRef.current.innerHTML = "";
          mapContainerRef.current.appendChild(map3d);
          map3dElementRef.current = map3d;
          setNative3DLoaded(true);
        }
      } catch (e) {
        console.warn("Native Google 3D load notice, using standard 3D viewport:", e);
      }
    };

    void loadMaps3D();

    return () => {
      isMounted = false;
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = "";
      }
    };
  }, [handleMapClick]);

  // Handle center pin selection (for iframe or manual selection)
  const handleSelectCurrentCenter = async () => {
    if (isLocating) return;
    setIsLocating(true);

    try {
      // Coordinates of highlighted exploration hub
      const lat = selectedLocation ? selectedLocation.lat : 29.9792;
      const lng = selectedLocation ? selectedLocation.lng : 31.1342;

      const info = await reverseGeocode(lat, lng);
      if (onLocationSelect) {
        onLocationSelect({
          name: info.locationName,
          country: info.country,
          city: info.city,
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
      {/* 1. Google Maps 3D Live Engine: 100% interactive, mouse moves and orbits smoothly */}
      <div
        ref={mapContainerRef}
        className="w-full h-full relative overflow-hidden bg-black select-none pointer-events-auto"
      >
        {!native3DLoaded && (
          <iframe
            src="https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/"
            title="Google Maps Photorealistic 3D Globe with Place Names"
            className="absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto"
            allow="geolocation; accelerometer; gyroscope"
            loading="eager"
          />
        )}
      </div>

      {/* 2. THE RED ICON (Pointer Pin & Selection Badge) */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {/* Dynamic Red Pin at Click Position OR Screen Center */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center pointer-events-none transition-all duration-300"
          style={{
            left: pinScreenPos ? `${pinScreenPos.x}px` : "50%",
            top: pinScreenPos ? `${pinScreenPos.y}px` : "50%",
          }}
        >
          {/* Action Button: Click to Select Place & Talk to Agent */}
          <button
            type="button"
            onClick={handleSelectCurrentCenter}
            className="pointer-events-auto mb-2 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-[0_4px_25px_rgba(239,68,68,0.9)] border border-white/20 transition-all transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            title={language === "ar" ? "اضغط لاختيار هذا المكان والتحدث مع الرفيق" : "Click to select place and talk to agent"}
          >
            <MapPin className="w-3.5 h-3.5 text-white fill-white" />
            <span>
              {isLocating
                ? language === "ar"
                  ? "جارٍ تحديد المكان..."
                  : "Locating..."
                : language === "ar"
                ? "تحديد هذا المكان والتحدث"
                : "Select Place & Talk"}
            </span>
          </button>

          {/* Glowing Red Icon Marker with Radar Pulse */}
          <div className="relative flex flex-col items-center">
            {/* Pulsing Beacon Waves */}
            <span className="absolute -inset-2 rounded-full bg-red-500/40 animate-ping" />
            <span className="absolute -inset-4 rounded-full bg-red-600/20 animate-pulse" />

            {/* Red Pin Sphere */}
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 via-rose-500 to-red-500 border-2 border-white flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,1)]">
              <MapPin className="w-5 h-5 text-white fill-white" />
            </div>

            {/* Pin Pointer Stem */}
            <div className="w-1.5 h-2.5 bg-white -mt-0.5 rounded-b-full shadow-md" />
            <span className="w-3.5 h-3.5 rounded-full bg-red-500 -mt-0.5 shadow-[0_0_15px_#ef4444]" />
          </div>

          {/* Active Place Label under the Red Pin */}
          {selectedLocation && (
            <div className="mt-2 px-3 py-1 rounded-full bg-black/90 backdrop-blur-md border border-red-500/60 text-white text-xs font-medium flex items-center gap-2 shadow-2xl animate-fade-in pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="truncate max-w-[220px]">{selectedLocation.name}</span>
              {isExploring && <Loader2 className="w-3 h-3 text-red-400 animate-spin" />}
            </div>
          )}
        </div>

        {/* Floating Active Status HUD on Bottom-Left */}
        {selectedLocation && (
          <div className="absolute bottom-5 left-5 pointer-events-auto bg-black/85 backdrop-blur-md border border-red-500/40 rounded-xl px-4 py-2.5 text-white shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 shrink-0 border border-red-400/30">
              <MapPin className="w-4 h-4 fill-red-400" />
              {isExploring && (
                <span className="absolute inset-0 rounded-full border border-red-400 animate-ping opacity-75" />
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[11px] text-red-300 font-medium flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                <span>
                  {isExploring
                    ? language === "ar"
                      ? "الرفيق يجهّز النبذة والطقس..."
                      : "Agent is briefing you..."
                    : language === "ar"
                    ? "المكان المحدد في المحادثة"
                    : "Selected Location"}
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
