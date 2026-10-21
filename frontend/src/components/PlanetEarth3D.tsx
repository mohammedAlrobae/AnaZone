"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Compass, RotateCw, Globe2, Sparkles, Navigation, Volume2, Info } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface PlanetEarth3DProps {
  onLocationSelect: (loc: LocationSelected) => void;
  selectedLocation: LocationSelected | null;
  isExploring?: boolean;
}

// Iconic landmarks for quick exploration
const LANDMARKS = [
  { name: "Pyramids of Giza", country: "Egypt", city: "Giza", lat: 29.9792, lng: 31.1342, emoji: "🏜️" },
  { name: "Mecca Al-Haram", country: "Saudi Arabia", city: "Mecca", lat: 21.4225, lng: 39.8262, emoji: "🕋" },
  { name: "Tokyo Tower", country: "Japan", city: "Tokyo", lat: 35.6586, lng: 139.7454, emoji: "⛩️" },
  { name: "Eiffel Tower", country: "France", city: "Paris", lat: 48.8584, lng: 2.2945, emoji: "🗼" },
  { name: "Statue of Liberty", country: "USA", city: "New York", lat: 40.6892, lng: -74.0445, emoji: "🗽" },
  { name: "Amazon Rainforest", country: "Brazil", city: "Manaus", lat: -3.119, lng: -60.0217, emoji: "🌿" },
  { name: "Mount Everest", country: "Nepal", city: "Solukhumbu", lat: 27.9881, lng: 86.925, emoji: "🏔️" },
  { name: "Great Barrier Reef", country: "Australia", city: "Cairns", lat: -16.9186, lng: 145.7781, emoji: "🪸" },
];

const EARTH_RADIUS = 5;

// Convert Lat/Lng to 3D Cartesian coordinates on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Convert 3D Cartesian hit point on sphere back to Lat/Lng
function vector3ToLatLng(vec: THREE.Vector3, radius: number): { lat: number; lng: number } {
  const norm = vec.clone().normalize();
  const lat = 90 - Math.acos(norm.y) * (180 / Math.PI);
  let lng = (Math.atan2(norm.z, -norm.x) * (180 / Math.PI)) - 180;
  // Normalize lng to [-180, 180]
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return { lat, lng };
}

export default function PlanetEarth3D({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: PlanetEarth3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = useI18n();

  const [mouseCoords, setMouseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [activeLandmark, setActiveLandmark] = useState<string | null>(null);

  // References for Three.js elements
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const pinGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Interaction controls
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0.2, y: 0 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0.2, y: 0 });
  const cameraDistanceRef = useRef<number>(12);
  const targetCameraDistanceRef = useRef<number>(12);
  const autoRotateRef = useRef<boolean>(true);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  // Reverse geocoding handler
  const handlePointSelection = useCallback(
    async (lat: number, lng: number) => {
      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(4)}&lon=${lng.toFixed(
            4
          )}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone3DEarth/1.0" } }
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
          } else {
            locationName =
              language === "ar" ? "محيط أو منطقة جغرافية" : "Ocean / Open Geographic Region";
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

  // Update glowing pin when selected location changes
  const updateBeaconPin = useCallback((lat: number, lng: number) => {
    if (!pinGroupRef.current || !earthMeshRef.current) return;

    // Clear previous pins
    while (pinGroupRef.current.children.length > 0) {
      const obj = pinGroupRef.current.children[0];
      pinGroupRef.current.remove(obj);
    }

    const pos = latLngToVector3(lat, lng, EARTH_RADIUS * 1.01);

    // Glowing core sphere
    const coreGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.copy(pos);
    pinGroupRef.current.add(coreMesh);

    // Outer pulsing ring
    const ringGeo = new THREE.RingGeometry(0.18, 0.32, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(pos);
    ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
    pinGroupRef.current.add(ringMesh);

    // Light beam radiating outwards
    const beamGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.9, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    const outwardPos = pos.clone().multiplyScalar(1.08);
    beamMesh.position.copy(outwardPos);
    beamMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
    pinGroupRef.current.add(beamMesh);
  }, []);

  // Smoothly rotate globe to face coordinates
  const flyToCoordinates = useCallback(
    (lat: number, lng: number) => {
      setAutoRotate(false);
      // Desired rotation to center the coordinate in front of the camera:
      // Camera is looking down -Z (or along Z axis).
      const targetY = -((lng + 90) * (Math.PI / 180));
      const targetX = (lat * (Math.PI / 180)) * 0.7;

      targetRotationRef.current = { x: targetX, y: targetY };
      targetCameraDistanceRef.current = 9.5; // Smooth zoom in
      updateBeaconPin(lat, lng);
    },
    [updateBeaconPin]
  );

  // React to selected location prop change
  useEffect(() => {
    if (selectedLocation) {
      flyToCoordinates(selectedLocation.lat, selectedLocation.lng);
    }
  }, [selectedLocation, flyToCoordinates]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = cameraDistanceRef.current;
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(15, 10, 15);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-15, -5, -10);
    scene.add(rimLight);

    // 5. Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const starCoords = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 60 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      starCoords[i] = radius * Math.sin(phi) * Math.cos(theta);
      starCoords[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starCoords[i + 2] = radius * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starCoords, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.6,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 6. Texture Loader (Loading local high-res NASA assets)
    const textureLoader = new THREE.TextureLoader();
    const dayMap = textureLoader.load("/textures/earth/earth_day.jpg");
    const normalMap = textureLoader.load("/textures/earth/earth_normal.jpg");
    const specularMap = textureLoader.load("/textures/earth/earth_specular.jpg");
    const cloudsMap = textureLoader.load("/textures/earth/earth_clouds.png");
    const lightsMap = textureLoader.load("/textures/earth/earth_lights.png");

    dayMap.colorSpace = THREE.SRGBColorSpace;
    lightsMap.colorSpace = THREE.SRGBColorSpace;

    // 7. Earth Sphere
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: dayMap,
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: specularMap,
      roughness: 0.6,
      metalness: 0.1,
      emissive: new THREE.Color(0xffe082),
      emissiveMap: lightsMap,
      emissiveIntensity: 0.35,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    scene.add(earthMesh);

    // 8. Clouds Layer
    const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.015, 64, 64);
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: cloudsMap,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    cloudsMeshRef.current = cloudsMesh;
    earthMesh.add(cloudsMesh);

    // 9. Atmospheric Scattering Glow
    const atmosphereGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.07, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.25, 0.68, 1.0, 1.0) * intensity * 1.4;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // 10. Pins and Markers Group
    const pinGroup = new THREE.Group();
    pinGroupRef.current = pinGroup;
    earthMesh.add(pinGroup);

    // Raycaster for click and hover coordinate calculation
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Event Handlers for Dragging & Rotating
    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDraggingRef.current) {
        const deltaX = e.clientX - previousMousePositionRef.current.x;
        const deltaY = e.clientY - previousMousePositionRef.current.y;

        targetRotationRef.current.y += deltaX * 0.005;
        targetRotationRef.current.x = Math.max(
          -Math.PI / 2.3,
          Math.min(Math.PI / 2.3, targetRotationRef.current.x + deltaY * 0.005)
        );

        previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
        setAutoRotate(false);
      }

      // Check hover coordinates
      raycaster.setFromCamera(mouse, camera);
      if (earthMeshRef.current) {
        const intersects = raycaster.intersectObject(earthMeshRef.current);
        if (intersects.length > 0) {
          const localPoint = earthMeshRef.current.worldToLocal(intersects[0].point.clone());
          const coords = vector3ToLatLng(localPoint, EARTH_RADIUS);
          setMouseCoords({
            lat: parseFloat(coords.lat.toFixed(4)),
            lng: parseFloat(coords.lng.toFixed(4)),
          });
        }
      }
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    // Click on surface to select coordinate and explore
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      if (earthMeshRef.current) {
        const intersects = raycaster.intersectObject(earthMeshRef.current);
        if (intersects.length > 0) {
          const localPoint = earthMeshRef.current.worldToLocal(intersects[0].point.clone());
          const coords = vector3ToLatLng(localPoint, EARTH_RADIUS);
          updateBeaconPin(coords.lat, coords.lng);
          void handlePointSelection(coords.lat, coords.lng);
        }
      }
    };

    // Zoom on wheel
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetCameraDistanceRef.current = Math.max(
        7.5,
        Math.min(22, targetCameraDistanceRef.current + e.deltaY * 0.01)
      );
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("click", onClick);
    container.addEventListener("wheel", onWheel, { passive: false });

    // Handle Resize
    const onResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (autoRotateRef.current && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.0015;
      }

      // Smooth damping interpolation
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.08;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.08;
      cameraDistanceRef.current += (targetCameraDistanceRef.current - cameraDistanceRef.current) * 0.1;

      if (cameraRef.current) {
        cameraRef.current.position.z = cameraDistanceRef.current;
      }

      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.x = currentRotationRef.current.x;
        earthMeshRef.current.rotation.y = currentRotationRef.current.y;
      }

      // Slowly rotate clouds independently
      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += delta * 0.02;
      }

      // Pulse pin beacons
      if (pinGroupRef.current && pinGroupRef.current.children.length > 1) {
        const ring = pinGroupRef.current.children[1] as THREE.Mesh;
        if (ring) {
          const time = clock.getElapsedTime() * 3;
          const scale = 1 + Math.sin(time) * 0.25;
          ring.scale.set(scale, scale, scale);
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("click", onClick);
      container.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);

      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [handlePointSelection, updateBeaconPin]);

  return (
    <div className="w-full h-full min-h-0 rounded-xl relative overflow-hidden text-white flex flex-col bg-[#050b14] select-none shadow-2xl">
      {/* 3D Canvas Canvas Container */}
      <div className="relative flex-1 w-full min-h-0 cursor-grab active:cursor-grabbing">
        <div ref={mountRef} className="w-full h-full z-0" />

        {/* Selected Location Pill Banner */}
        {selectedLocation && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-[#1e293b]/90 backdrop-blur-md border border-cyan-500/30 rounded-full px-4 py-1.5 flex items-center gap-2 text-white max-w-[90%] text-xs shadow-lg animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
            <span className="text-white/80 font-normal">{t.activeLocationLabel}:</span>
            <span className="font-medium text-cyan-200 truncate">{selectedLocation.name}</span>
            {isExploring && (
              <span className="flex items-center gap-1 text-[11px] text-amber-300 ml-1">
                <Volume2 className="w-3 h-3 animate-spin" />
                <span>{language === "ar" ? "جاري الإيجاز..." : "Briefing..."}</span>
              </span>
            )}
          </div>
        )}

        {/* Floating Controls Overlay */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          {/* Auto Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            title={autoRotate ? "Pause Rotation" : "Auto Rotate"}
            className={`p-2 rounded-lg backdrop-blur-md border transition-all text-xs flex items-center gap-1.5 ${
              autoRotate
                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-200 shadow-cyan-500/20 shadow-md"
                : "bg-black/40 border-white/10 text-white/70 hover:text-white hover:bg-black/60"
            }`}
          >
            <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? "animate-spin" : ""}`} />
            <span className="text-[11px] font-medium hidden sm:inline">
              {autoRotate ? (language === "ar" ? "دوران تلقائي" : "Rotating") : (language === "ar" ? "إيقاف" : "Rotate")}
            </span>
          </button>

          {/* Reset Orbit View */}
          <button
            type="button"
            onClick={() => {
              targetRotationRef.current = { x: 0.2, y: 0 };
              targetCameraDistanceRef.current = 12;
            }}
            title="Reset Perspective"
            className="p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all text-xs flex items-center gap-1.5"
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium hidden sm:inline">
              {language === "ar" ? "إعادة ضبط" : "Reset"}
            </span>
          </button>
        </div>

        {/* Interactive Quick-Jump Landmarks Bar */}
        <div className="absolute bottom-11 left-3 right-3 z-10 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[10px] text-white/60 uppercase tracking-wider font-semibold shrink-0 flex items-center gap-1 pl-1">
            <Navigation className="w-3 h-3 text-cyan-400" />
            <span>{language === "ar" ? "معالم عالمية:" : "Teleport:"}</span>
          </span>
          {LANDMARKS.map((landmark) => (
            <button
              key={landmark.name}
              type="button"
              onClick={() => {
                setActiveLandmark(landmark.name);
                flyToCoordinates(landmark.lat, landmark.lng);
                void handlePointSelection(landmark.lat, landmark.lng);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] shrink-0 backdrop-blur-md border transition-all flex items-center gap-1 ${
                activeLandmark === landmark.name
                  ? "bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-sm"
                  : "bg-black/50 border-white/15 text-white/80 hover:bg-black/70 hover:border-cyan-400/50"
              }`}
            >
              <span>{landmark.emoji}</span>
              <span className="truncate max-w-[110px]">{landmark.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Slim HUD Bottom Bar (Coordinates, Controls Info & Signature Tone) */}
      <div className="w-full bg-[#0a1120] border-t border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-white shrink-0">
        {/* Coordinates Tracker */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-white/70 font-normal">{t.mapCoordsHud}:</span>
          <span className="font-mono text-cyan-300 font-medium">
            {mouseCoords
              ? `${mouseCoords.lat >= 0 ? `${mouseCoords.lat.toFixed(2)}° N` : `${Math.abs(mouseCoords.lat).toFixed(2)}° S`}, ${
                  mouseCoords.lng >= 0 ? `${mouseCoords.lng.toFixed(2)}° E` : `${Math.abs(mouseCoords.lng).toFixed(2)}° W`
                }`
              : "0.00° N, 0.00° E (Space Orbit)"}
          </span>
        </div>

        {/* Interaction Hint */}
        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
          <Info className="w-3 h-3 text-cyan-400/80" />
          <span>
            {language === "ar"
              ? "اسحب للتدوير • عجلة الفأرة للتقريب • انقر لاستكشاف أي موقع بصوت المساعد"
              : "Drag to rotate • Scroll to zoom • Click anywhere to explore with Voice AI"}
          </span>
        </div>
      </div>
    </div>
  );
}
