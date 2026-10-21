"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Key, ExternalLink, Sparkles, Navigation, RotateCw, Compass, Eye, Building2, Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface GoogleMaps3DProps {
  onLocationSelect: (loc: LocationSelected) => void;
  selectedLocation: LocationSelected | null;
  isExploring?: boolean;
}

export default function GoogleMaps3D({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: GoogleMaps3DProps) {
  const { language } = useI18n();
  const mapMountRef = useRef<HTMLDivElement | null>(null);
  const mapElementRef = useRef<any>(null);

  // API Key state
  const [apiKey, setApiKey] = useState<string>("");
  const [inputKey, setInputKey] = useState<string>("");
  const [isScriptLoaded, setIsScriptLoaded] = useState<boolean>(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<"space" | "city">("space");

  // Load key from env or localStorage
  useEffect(() => {
    const envKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const storedKey = typeof window !== "undefined" ? localStorage.getItem("google_maps_3d_key") : null;
    const key = envKey || storedKey || "";
    setApiKey(key);
    setInputKey(key);
  }, []);

  // Save custom key
  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputKey.trim();
    setApiKey(trimmed);
    if (typeof window !== "undefined") {
      localStorage.setItem("google_maps_3d_key", trimmed);
    }
  };

  // Reverse geocoding helper
  const handlePointSelection = useCallback(
    async (lat: number, lng: number) => {
      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(
            4
          )}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZoneGoogle3D/1.0" } }
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

        onLocationSelect({
          name: locationName,
          country,
          city,
          lat: parseFloat(lat.toFixed(4)),
          lng: parseFloat(lng.toFixed(4)),
        });
      } catch (err) {
        console.warn("Reverse geocode error:", err);
        onLocationSelect({
          name: `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
          country: "",
          city: "",
          lat: parseFloat(lat.toFixed(4)),
          lng: parseFloat(lng.toFixed(4)),
        });
      }
    },
    [language, onLocationSelect]
  );

  // Load Google Maps JS API with maps3d library
  useEffect(() => {
    if (!apiKey) return;

    let isMounted = true;
    setScriptError(null);

    const scriptId = "google-maps-3d-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=maps3d&v=weekly`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (isMounted) setIsScriptLoaded(true);
      };

      script.onerror = () => {
        if (isMounted) setScriptError("Failed to authenticate or load Google Maps 3D script.");
      };

      document.head.appendChild(script);
    } else {
      if ((window as any).google?.maps?.importLibrary) {
        setIsScriptLoaded(true);
      } else {
        script.addEventListener("load", () => {
          if (isMounted) setIsScriptLoaded(true);
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  // Mount <gmp-map-3d> once script is ready
  useEffect(() => {
    if (!isScriptLoaded || !mapMountRef.current) return;

    const mount = mapMountRef.current;
    mount.innerHTML = "";

    try {
      // Create <gmp-map-3d> custom element
      const map3d = document.createElement("gmp-map-3d") as any;
      map3d.style.width = "100%";
      map3d.style.height = "100%";
      map3d.setAttribute("mode", "hybrid");

      const initialLat = selectedLocation ? selectedLocation.lat : 29.9792;
      const initialLng = selectedLocation ? selectedLocation.lng : 31.1342;

      map3d.setAttribute("center", `${initialLat},${initialLng},0`);
      map3d.setAttribute("range", cameraMode === "space" ? "18000000" : "1800");
      map3d.setAttribute("tilt", cameraMode === "space" ? "0" : "62.5");
      map3d.setAttribute("heading", "0");

      // Add click listener on 3D map
      map3d.addEventListener("gmp-click", (e: any) => {
        if (e.position) {
          const { lat, lng } = e.position;
          void handlePointSelection(lat, lng);
        }
      });

      mount.appendChild(map3d);
      mapElementRef.current = map3d;
    } catch (err: any) {
      console.error("Error creating <gmp-map-3d>:", err);
      setScriptError(err?.message || "Error rendering 3D map component.");
    }

    return () => {
      if (mount) mount.innerHTML = "";
      mapElementRef.current = null;
    };
  }, [isScriptLoaded, handlePointSelection]);

  // Fly camera to selected location when changed
  useEffect(() => {
    if (!mapElementRef.current || !selectedLocation) return;

    try {
      const map3d = mapElementRef.current;
      const range = cameraMode === "city" ? 1800 : 8000000;
      const tilt = cameraMode === "city" ? 65 : 20;

      if (typeof map3d.flyCameraTo === "function") {
        map3d.flyCameraTo({
          endCamera: {
            center: { lat: selectedLocation.lat, lng: selectedLocation.lng, altitude: 0 },
            range,
            tilt,
            heading: 0,
          },
          durationMillis: 2500,
        });
      } else {
        map3d.setAttribute("center", `${selectedLocation.lat},${selectedLocation.lng},0`);
        map3d.setAttribute("range", range.toString());
      }
    } catch (e) {
      console.warn("Fly camera error:", e);
    }
  }, [selectedLocation, cameraMode]);

  // Orbit camera around target
  const handleFlyAround = () => {
    if (!mapElementRef.current) return;
    try {
      const map3d = mapElementRef.current;
      if (typeof map3d.flyCameraAround === "function") {
        const center = selectedLocation
          ? { lat: selectedLocation.lat, lng: selectedLocation.lng, altitude: 0 }
          : { lat: 29.9792, lng: 31.1342, altitude: 0 };
        map3d.flyCameraAround({
          camera: { center, tilt: 60, range: 2500 },
          durationMillis: 15000,
          rounds: 1,
        });
      }
    } catch (e) {
      console.warn("flyCameraAround error:", e);
    }
  };

  // Toggle between Space Orbit and 3D City Level
  const toggleViewMode = (mode: "space" | "city") => {
    setCameraMode(mode);
    if (!mapElementRef.current) return;
    const map3d = mapElementRef.current;
    const lat = selectedLocation ? selectedLocation.lat : 29.9792;
    const lng = selectedLocation ? selectedLocation.lng : 31.1342;

    if (mode === "space") {
      if (typeof map3d.flyCameraTo === "function") {
        map3d.flyCameraTo({
          endCamera: { center: { lat, lng, altitude: 0 }, range: 18000000, tilt: 0, heading: 0 },
          durationMillis: 2500,
        });
      } else {
        map3d.setAttribute("range", "18000000");
        map3d.setAttribute("tilt", "0");
      }
    } else {
      if (typeof map3d.flyCameraTo === "function") {
        map3d.flyCameraTo({
          endCamera: { center: { lat, lng, altitude: 0 }, range: 1800, tilt: 65, heading: 30 },
          durationMillis: 2500,
        });
      } else {
        map3d.setAttribute("range", "1800");
        map3d.setAttribute("tilt", "65");
      }
    }
  };

  return (
    <div className="w-full h-full min-h-0 rounded-xl relative overflow-hidden text-white flex flex-col bg-[#050b14] select-none shadow-2xl">
      {/* If Live Showcase Preview is requested */}
      {showLivePreview ? (
        <div className="relative flex-1 w-full min-h-0 flex flex-col bg-black">
          <div className="bg-[#0f172a] px-4 py-2 flex items-center justify-between border-b border-white/10 text-xs">
            <span className="flex items-center gap-2 text-cyan-300 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google Maps 3D Live Showcase (London 3D Flyover)</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLivePreview(false)}
              className="text-white/70 hover:text-white px-2 py-0.5 rounded bg-white/10 text-[11px]"
            >
              Close Live Preview
            </button>
          </div>
          <iframe
            src="https://com-maps-js-api.web.app/london.html"
            title="Google Maps 3D Live Showcase"
            className="w-full flex-1 border-0"
            allow="geolocation; gyroscope; accelerometer"
          />
        </div>
      ) : !apiKey ? (
        /* Setup / Key configuration banner */
        <div className="relative flex-1 w-full min-h-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0a1120] to-[#040810]">
          <div className="max-w-md w-full bg-[#0f172a]/90 backdrop-blur-md border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center mx-auto border border-cyan-400/40">
              <Globe2 className="w-6 h-6 animate-pulse" />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white tracking-tight">
                {language === "ar" ? "خرائط غوغل ثلاثية الأبعاد (3D Maps GA)" : "Google Maps 3D Platform (GA)"}
              </h3>
              <p className="text-xs text-white/75 mt-1 leading-relaxed">
                {language === "ar"
                  ? "لتشغيل ميزة خرائط غوغل ثلاثية الأبعاد الأصلية <gmp-map-3d>، يلزم إدخال مفتاح API من منصة Google Maps أو مفتاح تجريبي مجاني."
                  : "To enable the native Google Maps 3D <gmp-map-3d> component, enter your Google Maps Platform API Key or a free Demo Key (No credit card needed)."}
              </p>
            </div>

            <form onSubmit={handleSaveKey} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-lg text-xs transition-all shadow-md shadow-emerald-900/30"
              >
                {language === "ar" ? "تفعيل خرائط 3D" : "Activate Google 3D Maps"}
              </button>
            </form>

            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/60">
              <a
                href="https://mapsplatform.google.com/maps-demo-key/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>{language === "ar" ? "احصل على مفتاح تجريبي مجاني" : "Get Free Maps Demo Key"}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={() => setShowLivePreview(true)}
                className="text-amber-300 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3 h-3" />
                <span>{language === "ar" ? "تجربة العرض الحي (لندن 3D)" : "Try Live 3D Showcase"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : scriptError ? (
        /* Error State */
        <div className="relative flex-1 w-full min-h-0 flex flex-col items-center justify-center p-6 text-center bg-[#0a1120]">
          <div className="max-w-md bg-red-950/40 border border-red-500/40 rounded-xl p-5 space-y-3 text-red-200 text-xs">
            <p className="font-semibold">{scriptError}</p>
            <p className="text-white/70">
              Check that your Google Maps Platform project has enabled the <strong>Maps JavaScript API</strong> and <strong>Photorealistic 3D Maps</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setApiKey("");
                localStorage.removeItem("google_maps_3d_key");
              }}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white text-xs"
            >
              Change API Key
            </button>
          </div>
        </div>
      ) : (
        /* Active <gmp-map-3d> Container */
        <div className="relative flex-1 w-full min-h-0">
          <div ref={mapMountRef} className="w-full h-full" />

          {/* Camera Flight Controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => toggleViewMode("space")}
              className={`p-2 rounded-lg backdrop-blur-md border transition-all text-xs flex items-center gap-1.5 ${
                cameraMode === "space"
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                  : "bg-black/40 border-white/10 text-white/70 hover:text-white"
              }`}
              title="Planet Earth Space Orbit"
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">Orbit Earth</span>
            </button>

            <button
              type="button"
              onClick={() => toggleViewMode("city")}
              className={`p-2 rounded-lg backdrop-blur-md border transition-all text-xs flex items-center gap-1.5 ${
                cameraMode === "city"
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                  : "bg-black/40 border-white/10 text-white/70 hover:text-white"
              }`}
              title="3D Photorealistic Buildings"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">3D City View</span>
            </button>

            <button
              type="button"
              onClick={handleFlyAround}
              className="p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-all text-xs flex items-center gap-1.5"
              title="360° Rotate Camera"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium hidden sm:inline">360° Orbit</span>
            </button>
          </div>
        </div>
      )}

      {/* Slim HUD Bottom Bar */}
      <div className="w-full bg-[#0a1120] border-t border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-white shrink-0">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-white/70 font-normal">Google 3D Maps Engine:</span>
          <span className="font-mono text-cyan-300 font-medium">
            {apiKey ? "Active & Synchronized" : "Sandbox / Ready for API Key"}
          </span>
        </div>

        {apiKey && (
          <button
            type="button"
            onClick={() => {
              setApiKey("");
              localStorage.removeItem("google_maps_3d_key");
            }}
            className="text-[11px] text-white/50 hover:text-white underline"
          >
            Manage Key
          </button>
        )}
      </div>
    </div>
  );
}
