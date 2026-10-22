"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

const GOOGLE_MAPS_KEY = "AIzaSyA6myHzS10YXdcazAFalmXvDkrYCp5cLc8";

// Red Pin SVG cursor where the needle tip (12, 24) is the exact mouse pointer
const RED_PIN_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'><path fill='%23ef4444' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='%23ffffff'/></svg>") 12 24, crosshair`;

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<any>(null);
  const activeMarkerRef = useRef<any>(null);

  const handlePointSelect = useCallback(
    async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(
            4
          )}&format=json&accept-language=ar,en`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );

        let locationName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
        let country = "";
        let city = "";

        if (res.ok) {
          const data = await res.json();
          country = data.address?.country || "";
          city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.state ||
            "";

          if (city && country) {
            locationName = `${city}, ${country}`;
          } else if (country) {
            locationName = country;
          } else if (data.display_name) {
            locationName = data.display_name.split(",").slice(0, 2).join(",").trim();
          }
        }

        if (onLocationSelect) {
          onLocationSelect({
            name: locationName,
            country,
            city,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
          });
        }
      } catch (err) {
        console.warn("Geocoding notice:", err);
        if (onLocationSelect) {
          onLocationSelect({
            name: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
            country: "",
            city: "",
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
          });
        }
      }
    },
    [onLocationSelect]
  );

  useEffect(() => {
    let isMounted = true;
    const container = mountRef.current;
    if (!container) return;

    const initMap = async () => {
      try {
        if (!(window as any).google?.maps?.importLibrary) {
          await new Promise<void>((resolve, reject) => {
            const scriptId = "google-maps-3d-native-script";
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

        if (!isMounted || !container) return;

        const { Map3DElement, Marker3DElement } = await (window as any).google.maps.importLibrary("maps3d");

        const map3d = new Map3DElement({
          center: { lat: 26.0, lng: 38.0, altitude: 15000000 },
          tilt: 0,
          range: 0,
          heading: 0,
          roll: 0,
          mode: "HYBRID",
        });

        map3d.style.width = "100%";
        map3d.style.height = "100%";
        map3d.style.cursor = RED_PIN_CURSOR;

        // Mouse click on Google 3D Earth selects the exact location
        map3d.addEventListener("gmp-click", (event: any) => {
          if (!event || !event.position) return;
          const { lat, lng } = event.position;

          try {
            if (activeMarkerRef.current) {
              activeMarkerRef.current.remove();
            }
            const marker = new Marker3DElement({
              position: { lat, lng, altitude: 100 },
              altitudeMode: "RELATIVE_TO_GROUND",
            });
            map3d.append(marker);
            activeMarkerRef.current = marker;
          } catch (_) {}

          void handlePointSelect(lat, lng);
        });

        container.appendChild(map3d);
        mapElementRef.current = map3d;
      } catch (err) {
        console.error("Map3D load error, loading fallback viewport:", err);
        if (container && isMounted) {
          const iframe = document.createElement("iframe");
          iframe.src = "https://maps-docs-team.web.app/samples/3d-places-autocomplete/dist/";
          iframe.title = "Google Maps Photorealistic 3D Globe";
          iframe.className = "absolute -top-[145px] left-0 w-full h-[calc(100%+290px)] border-0 select-none pointer-events-auto";
          iframe.allow = "geolocation; accelerometer; gyroscope";
          iframe.style.cursor = RED_PIN_CURSOR;
          container.appendChild(iframe);
        }
      }
    };

    void initMap();

    return () => {
      isMounted = false;
      if (container) {
        container.innerHTML = "";
      }
      mapElementRef.current = null;
      activeMarkerRef.current = null;
    };
  }, [handlePointSelect]);

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-black select-none"
      style={{ cursor: RED_PIN_CURSOR }}
    >
      {/* 100% Clean Google 3D Earth: Mouse cursor itself IS the Red Pin */}
      <div
        ref={mountRef}
        className="w-full h-full relative overflow-hidden bg-black select-none pointer-events-auto"
        style={{ cursor: RED_PIN_CURSOR }}
      />
    </div>
  );
}
