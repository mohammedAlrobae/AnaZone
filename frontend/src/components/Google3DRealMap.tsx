"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";

interface Google3DRealMapProps {
  onLocationSelect?: (loc: LocationSelected) => void;
  selectedLocation?: LocationSelected | null;
  isExploring?: boolean;
}

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
  let lng = Math.atan2(norm.z, -norm.x) * (180 / Math.PI) - 180;
  while (lng < -180) lng += 360;
  while (lng > 180) lng -= 360;
  return { lat, lng };
}

export default function Google3DRealMap({
  onLocationSelect,
  selectedLocation,
  isExploring = false,
}: Google3DRealMapProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const { language } = useI18n();

  const [exploringName, setExploringName] = useState<string | null>(null);

  // References for Three.js elements
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const beaconGroupRef = useRef<THREE.Group | null>(null);

  // Drag & rotation controls
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Initial rotation: 0.15 tilt, facing Africa & Middle East
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0.15, y: -0.45 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0.15, y: -0.45 });
  const cameraDistanceRef = useRef<number>(11.5);
  const targetCameraDistanceRef = useRef<number>(11.5);

  // Update beacon pin at selected coordinates
  const updateBeaconPin = useCallback((lat: number, lng: number) => {
    if (!beaconGroupRef.current || !earthMeshRef.current) return;
    const group = beaconGroupRef.current;

    // Clear previous beacon meshes
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
    }

    const pos = latLngToVector3(lat, lng, EARTH_RADIUS);
    const normal = pos.clone().normalize();

    // 1. Core Pin Sphere
    const pinGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.08)));
    group.add(pinMesh);

    // 2. Pulsing Radar Ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.28, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(pos.clone().add(normal.clone().multiplyScalar(0.06)));
    ringMesh.lookAt(pos.clone().add(normal));
    group.add(ringMesh);
  }, []);

  // Reverse geocoding handler
  const handlePointSelection = useCallback(
    async (lat: number, lng: number) => {
      setExploringName(language === "ar" ? "جارٍ تحديد الموقع..." : "Locating place...");

      let locationName = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
      let country = "";
      let city = "";

      try {
        const langParam = language === "ar" ? "ar,en" : "en";
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat.toFixed(
            4
          )}&lon=${lng.toFixed(4)}&format=json&accept-language=${langParam}`,
          { headers: { "User-Agent": "AnaZone/1.0" } }
        );

        if (res.ok) {
          const data = await res.json();
          if (data) {
            const addr = data.address || {};
            country = addr.country || "";
            city = addr.city || addr.town || addr.village || addr.state || "";
            locationName =
              data.name ||
              city ||
              addr.tourism ||
              addr.historic ||
              data.display_name?.split(",")[0] ||
              locationName;
          }
        }
      } catch (err) {
        console.warn("Reverse geocode notice:", err);
      }

      setExploringName(locationName);

      if (onLocationSelect) {
        onLocationSelect({
          name: locationName,
          country,
          city,
          lat: parseFloat(lat.toFixed(4)),
          lng: parseFloat(lng.toFixed(4)),
        });
      }
    },
    [language, onLocationSelect]
  );

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.z = cameraDistanceRef.current;
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff8eb, 2.4);
    sunLight.position.set(15, 8, 12);
    scene.add(sunLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    blueRimLight.position.set(-15, -6, -10);
    scene.add(blueRimLight);

    // 5. Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1400;
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
      size: 0.65,
      transparent: true,
      opacity: 0.8,
    });
    const starField = new THREE.Points(starsGeo, starsMat);
    scene.add(starField);

    // 6. Earth Textures
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
    earthMesh.rotation.x = targetRotationRef.current.x;
    earthMesh.rotation.y = targetRotationRef.current.y;
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

    // 9. Atmospheric Glow
    const atmosphereGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.065, 64, 64);
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.22, 0.65, 1.0, 1.0) * intensity * 1.35;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    scene.add(atmosphereMesh);

    // 10. Beacon Pin Group
    const beaconGroup = new THREE.Group();
    beaconGroupRef.current = beaconGroup;
    earthMesh.add(beaconGroup);

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Event Handlers
    const onPointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x = Math.max(
        -Math.PI / 2.3,
        Math.min(Math.PI / 2.3, targetRotationRef.current.x + deltaY * 0.005)
      );

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDragging = isDraggingRef.current;
      isDraggingRef.current = false;

      // Distinguish click vs drag: movement < 8 pixels is a deliberate click!
      const dist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );

      if (wasDragging && dist < 8 && earthMeshRef.current && cameraRef.current) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, cameraRef.current);
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
    container.addEventListener("wheel", onWheel, { passive: false });

    // Window Resize
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
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera zoom
      cameraDistanceRef.current += (targetCameraDistanceRef.current - cameraDistanceRef.current) * 0.1;
      camera.position.z = cameraDistanceRef.current;

      // Smooth rotation dampening
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * 0.1;
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * 0.1;

      if (earthMeshRef.current) {
        earthMeshRef.current.rotation.x = currentRotationRef.current.x;
        earthMeshRef.current.rotation.y = currentRotationRef.current.y;
      }

      if (cloudsMeshRef.current) {
        cloudsMeshRef.current.rotation.y += 0.0003;
      }

      // Rotate starfield subtly
      starField.rotation.y += 0.0001;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [handlePointSelection, updateBeaconPin]);

  // Sync beacon when selectedLocation changes externally
  useEffect(() => {
    if (selectedLocation) {
      updateBeaconPin(selectedLocation.lat, selectedLocation.lng);
      setExploringName(selectedLocation.name);
    }
  }, [selectedLocation, updateBeaconPin]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-black select-none">
      {/* Real 3D Interactive WebGL Earth Canvas */}
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing z-0"
      />

      {/* Exploring Notice Badge */}
      {(isExploring || exploringName) && (
        <div className="absolute top-4 left-4 z-20 bg-black/85 backdrop-blur-md border border-white/20 text-white px-3.5 py-1.5 rounded-full shadow-xl flex items-center gap-2 text-xs font-normal pointer-events-none animate-in fade-in">
          {isExploring && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
          <span>
            {exploringName || (language === "ar" ? "جارٍ تجهيز النبذة الصوتية..." : "Agent is briefing you...")}
          </span>
        </div>
      )}
    </div>
  );
}
