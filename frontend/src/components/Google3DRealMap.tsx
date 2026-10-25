"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

interface MapCamera {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
}

interface Map3DElementLike extends HTMLElement {
  flyCameraTo?: (options: { endCamera: MapCamera; durationMillis: number }) => void;
}

type Marker3DElementLike = HTMLElement;

interface Maps3DLibrary {
  Map3DElement: new (options: {
    center: MapCamera["center"];
    tilt: number;
    range: number;
    heading: number;
    roll: number;
    mode: "HYBRID";
  }) => Map3DElementLike;
  Marker3DElement: new (options: {
    position: MapCamera["center"];
    altitudeMode: "RELATIVE_TO_GROUND";
  }) => Marker3DElementLike;
}

interface GoogleMapsApi {
  importLibrary: (name: "maps3d") => Promise<Maps3DLibrary>;
}

type GoogleWindow = Omit<Window, "google"> & {
  google?: { maps?: GoogleMapsApi };
};

type MapClickEvent = Event & {
  position?: { lat: number; lng: number };
};

// Red Pin SVG cursor: the needle tip at (12, 24) is the exact mouse pointer
const RED_PIN_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24'><path fill='%23ef4444' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/><circle cx='12' cy='9' r='2.5' fill='%23ffffff'/></svg>") 12 24, crosshair`;

// Reusable audio unlocker without creating multiple AudioContexts
let sharedAudioContext: AudioContext | null = null;
function unlockUserAudioGesture() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      void sharedAudioContext.resume();
    }
  } catch (error) {
    console.warn("Audio context could not be resumed:", error);
  }
}

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
}: Google3DRealMapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<Map3DElementLike | null>(null);
  const activeMarkerRef = useRef<Marker3DElementLike | null>(null);
  const [mapError, setMapError] = React.useState<string | null>(null);

  const handlePointSelect = useCallback(
    async (lat: number, lng: number) => {
      // Safely unlock browser audio context on user gesture using shared instance
      unlockUserAudioGesture();

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
        const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!mapsKey) {
          setMapError("Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to load the 3D map.");
          return;
        }
        setMapError(null);

        if (!(window as GoogleWindow).google?.maps?.importLibrary) {
          await new Promise<void>((resolve, reject) => {
            const scriptId = "google-maps-3d-native-script";
            let script = document.getElementById(scriptId) as HTMLScriptElement | null;
            let scriptLoadFailed = false;
            if (!script) {
              script = document.createElement("script");
              script.id = scriptId;
              script.src = `https://maps.googleapis.com/maps/api/js?loading=async&key=${mapsKey}&libraries=maps3d`;
              script.async = true;
              script.onerror = () => {
                scriptLoadFailed = true;
                reject(new Error("Google Maps JavaScript API failed to load"));
              };
              document.head.appendChild(script);
            }

            const deadline = Date.now() + 10000;
            const waitForLibrary = () => {
              if ((window as GoogleWindow).google?.maps?.importLibrary) {
                resolve();
              } else if (scriptLoadFailed) {
                return;
              } else if (Date.now() >= deadline) {
                reject(new Error("Google Maps JavaScript API did not become ready"));
              } else {
                window.setTimeout(waitForLibrary, 50);
              }
            };
            waitForLibrary();
          });
        }

        if (!isMounted || !container) return;

        const mapsApi = (window as GoogleWindow).google?.maps;
        if (!mapsApi?.importLibrary) {
          throw new Error("Google Maps 3D library did not initialize");
        }
        const { Map3DElement, Marker3DElement } = await mapsApi.importLibrary("maps3d");

        const map3d = new Map3DElement({
          center: { lat: 26.0, lng: 38.0, altitude: 0 },
          tilt: 0,
          range: 15000000,
          heading: 0,
          roll: 0,
          mode: "HYBRID",
        });

        map3d.style.width = "100%";
        map3d.style.height = "100%";
        map3d.style.cursor = RED_PIN_CURSOR;

        // Native 3D interaction: Drag/orbit is fully active, clicking triggers selection
        map3d.addEventListener("gmp-click", (event) => {
          const position = (event as MapClickEvent).position;
          if (!position) return;
          const { lat, lng } = position;

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
          } catch (error) {
            console.warn("Could not place map marker:", error);
          }

          void handlePointSelect(lat, lng);
        });

        container.appendChild(map3d);
        mapElementRef.current = map3d;
      } catch (err) {
        console.error("Could not load Google Maps 3D:", err);
        if (isMounted) setMapError("Google Maps 3D failed to load. Check the API key and Maps JavaScript API settings.");
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

  useEffect(() => {
    const map3d = mapElementRef.current;
    if (!map3d || !selectedLocation) return;

    map3d.flyCameraTo?.({
      endCamera: {
        center: { lat: selectedLocation.lat, lng: selectedLocation.lng, altitude: 0 },
        range: 1800,
        tilt: 60,
        heading: 0,
      },
      durationMillis: 2500,
    });
  }, [selectedLocation]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative overflow-hidden bg-black select-none pointer-events-auto"
      style={{ cursor: RED_PIN_CURSOR }}
    >
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 p-6 text-center text-white">
          <p className="max-w-md text-sm">{mapError}</p>
        </div>
      )}
    </div>
  );
}
