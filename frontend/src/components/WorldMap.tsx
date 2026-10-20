"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Compass, MapPin, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState<boolean>(false);
  const [activeLayer, setActiveLayer] = useState<"satellite" | "topo" | "streets">("satellite");
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsTileLayerRef = useRef<L.TileLayer | null>(null);

  const { t, language } = useI18n();
  const handleCoordinatesClickRef = useRef<(lat: number, lng: number) => Promise<void>>(
    async () => {}
  );

  const placePulsingMarker = useCallback(async (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    const L = (await import("leaflet")).default;
    if (!mapInstanceRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const customIcon = L.divIcon({
        className: "map-pulsing-marker",
        html: `
          <div style="
            width: 14px;
            height: 14px;
            background: #ffffff;
            border: 3px solid #2e8b57;
            border-radius: 50%;
          "></div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      markerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
    }
  }, []);

  const setLayer = useCallback(async (type: "satellite" | "topo" | "streets") => {
    if (!mapInstanceRef.current) return;
    const L = (await import("leaflet")).default;

    if (baseTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (labelsTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(labelsTileLayerRef.current);
      labelsTileLayerRef.current = null;
    }

    if (type === "satellite") {
      baseTileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(mapInstanceRef.current);

      labelsTileLayerRef.current = L.tileLayer(
        "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(mapInstanceRef.current);
    } else if (type === "topo") {
      baseTileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(mapInstanceRef.current);
    } else {
      baseTileLayerRef.current = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, subdomains: "abc" }
      ).addTo(mapInstanceRef.current);
    }

    setActiveLayer(type);
  }, []);

  const handleCoordinatesClick = useCallback(async (lat: number, lng: number) => {
    await placePulsingMarker(lat, lng);
    setIsReverseGeocoding(true);

    try {
      const langParam = language === "ar" ? "ar,en" : "en";
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${langParam}`,
        {
          headers: {
            "User-Agent": "VoiceGeographyExplorer/1.0",
          },
        }
      );

      let locationName = `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`;
      let country = "";
      let city = "";

      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        country = address.country || "";
        city = address.city || address.town || address.village || address.state || address.region || "";

        if (city && country) {
          locationName = `${city}, ${country}`;
        } else if (country) {
          locationName = country;
        } else if (data.display_name) {
          locationName = data.display_name.split(",").slice(0, 2).join(",").trim();
        } else {
          locationName = language === "ar" ? "مسطح مائي أو منطقة جغرافية" : "Ocean or Geographical Area";
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
      console.warn("Reverse geocode fallback:", err);
      onLocationSelect({
        name: `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`,
        country: "",
        city: "",
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [language, onLocationSelect, placePulsingMarker]);

  useEffect(() => {
    handleCoordinatesClickRef.current = handleCoordinatesClick;
  }, [handleCoordinatesClick]);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === "undefined" || !mapContainerRef.current || mapInstanceRef.current) {
        return;
      }

      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [26.0, 30.0],
        zoom: 3,
        minZoom: 2,
        maxZoom: 18,
        worldCopyJump: true,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;
      await setLayer("satellite");

      setTimeout(() => {
        map.invalidateSize();
      }, 150);

      map.on("mousemove", (e) => {
        if (!isMounted) return;
        setMouseCoords({
          lat: parseFloat(e.latlng.lat.toFixed(4)),
          lng: parseFloat(e.latlng.lng.toFixed(4)),
        });
      });

      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        await handleCoordinatesClickRef.current(lat, lng);
      });
    };

    void initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [setLayer]);

  useEffect(() => {
    if (!mapInstanceRef.current || !selectedLocation) return;

    let isCancelled = false;
    const updateMarker = async () => {
      const { lat, lng } = selectedLocation;
      await placePulsingMarker(lat, lng);
      if (isCancelled) return;
      mapInstanceRef.current?.flyTo([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 5), {
        duration: 1.2,
      });
    };

    void updateMarker();
    return () => {
      isCancelled = true;
    };
  }, [selectedLocation, placePulsingMarker]);

  return (
    <div className="w-full h-full min-h-0 rounded-xl relative overflow-hidden text-white flex flex-col">
      {/* Maximized Full-Size Map Canvas */}
      <div className="relative flex-1 w-full min-h-0">
        <div ref={mapContainerRef} className="w-full h-full z-0 cursor-crosshair bg-[#78866B]" />


        {/* Selected Location Bar */}
        {selectedLocation && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-[#78866B] rounded-lg px-4 py-1.5 flex items-center gap-2 text-white max-w-[90%] text-xs">
            <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
            <span className="text-white/80 font-normal">{t.activeLocationLabel}:</span>
            <span className="font-normal text-white truncate">{selectedLocation.name}</span>
          </div>
        )}
      </div>

      {/* Slim Bottom Bar with #78866B (Coordinates & Plain Text Layer Switcher - No Borders, No Button Shapes) */}
      <div className="w-full bg-[#78866B] px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs text-white shrink-0">
        {/* Coordinates */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          <Compass className="w-3.5 h-3.5 text-white/90 shrink-0" />
          <span className="text-white/85 font-normal">{t.mapCoordsHud}:</span>
          <span className="font-mono text-white font-normal">
            {mouseCoords
              ? `${mouseCoords.lat > 0 ? `${mouseCoords.lat}° N` : `${Math.abs(mouseCoords.lat)}° S`}, ${mouseCoords.lng > 0 ? `${mouseCoords.lng}° E` : `${Math.abs(mouseCoords.lng)}° W`}`
              : "26.0000° N, 30.0000° E"}
          </span>
        </div>

        {/* Plain Text Layer Clickable Links - NO BUTTON LOOK, NO BORDERS */}
        <div className="flex items-center gap-3 text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={() => void setLayer("satellite")}
            className={`transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs font-normal ${
              activeLayer === "satellite"
                ? "text-white underline underline-offset-4 decoration-white"
                : "text-white/75 hover:text-white"
            }`}
          >
            {language === "ar" ? "طبيعي وقمر صناعي" : "Satellite & Nature"}
          </button>
          <span className="text-white/40">•</span>
          <button
            type="button"
            onClick={() => void setLayer("topo")}
            className={`transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs font-normal ${
              activeLayer === "topo"
                ? "text-white underline underline-offset-4 decoration-white"
                : "text-white/75 hover:text-white"
            }`}
          >
            {language === "ar" ? "تضاريس" : "Topography"}
          </button>
          <span className="text-white/40">•</span>
          <button
            type="button"
            onClick={() => void setLayer("streets")}
            className={`transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs font-normal ${
              activeLayer === "streets"
                ? "text-white underline underline-offset-4 decoration-white"
                : "text-white/75 hover:text-white"
            }`}
          >
            {language === "ar" ? "خريطة" : "Streets"}
          </button>
        </div>
      </div>
    </div>
  );
}
