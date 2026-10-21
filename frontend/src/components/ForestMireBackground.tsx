"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

interface MudBubble {
  id: number;
  x: number;
  y: number;
  size: number;
  life: number;
  maxLife: number;
  popped: boolean;
  colorTone: string;
}

interface MudSpore {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
}

export default function ForestMireBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bubbles, setBubbles] = useState<MudBubble[]>([]);
  const nextBubbleId = useRef<number>(1);
  const mousePos = useRef<{ x: number; y: number; isInside: boolean }>({
    x: 0,
    y: 0,
    isInside: false,
  });
  const lastMoveTime = useRef<number>(0);

  // Pre-generate ambient forest bio-spores with deterministic seed for SSR purity
  const [spores, setSpores] = useState<MudSpore[]>([]);

  useEffect(() => {
    // Generate organic spores on client mount
    setSpores(
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: ((i * 37.7) % 94) + 3,
        y: ((i * 49.3) % 88) + 6,
        size: 2 + ((i * 5) % 3.5),
        duration: 8 + ((i * 4) % 8),
        delay: (i * 0.35) % 4.5,
        driftX: (i % 2 === 0 ? 1 : -1) * (18 + ((i * 6) % 30)),
        driftY: -35 - ((i * 8) % 45),
      }))
    );
  }, []);

  // -------------------------------------------------------------
  // 1. Spawning Organic Mud / Methane Mire Bubbles
  // -------------------------------------------------------------
  const spawnBubble = useCallback((forceX?: number, forceY?: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x =
      forceX !== undefined
        ? forceX
        : 8 + Math.random() * (rect.width - 16);
    const y =
      forceY !== undefined
        ? forceY
        : 12 + Math.random() * (rect.height - 24);

    const tones = [
      "from-[#3b2a1a]/85 via-[#23180f]/90 to-[#120c08]/95", // Deep rich peat
      "from-[#443522]/80 via-[#2d2215]/90 to-[#17120a]/95", // Wet clay loam
      "from-[#343e24]/75 via-[#1e2714]/85 to-[#0f150a]/95", // Mossy mire silt
      "from-[#523d24]/70 via-[#362616]/85 to-[#1c120a]/95", // Amber wet sheen
    ];

    const newBubble: MudBubble = {
      id: nextBubbleId.current++,
      x,
      y,
      size: 18 + Math.random() * 26,
      life: 0,
      maxLife: 3200 + Math.random() * 2400,
      popped: false,
      colorTone: tones[Math.floor(Math.random() * tones.length)],
    };

    setBubbles((prev) => [...prev.slice(-8), newBubble]);
  }, []);

  // Ambient spontaneous mud bubble loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Spawn 1-2 bubbles organically
      spawnBubble();
      if (Math.random() > 0.45) {
        setTimeout(() => spawnBubble(), 400 + Math.random() * 600);
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [spawnBubble]);

  // -------------------------------------------------------------
  // 2. High-Performance Canvas for Viscous Mud Ripples & Squelch
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas);

    interface Ripple {
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      speed: number;
      opacity: number;
      decay: number;
      lineWidth: number;
      hueShift: number;
    }

    const ripples: Ripple[] = [];

    const addRipple = (x: number, y: number, power = 1) => {
      if (ripples.length > 28) ripples.shift();
      ripples.push({
        x,
        y,
        radius: 3 * power,
        maxRadius: (65 + Math.random() * 45) * power,
        speed: 0.65 + Math.random() * 0.45, // Slow, viscous expansion
        opacity: Math.min(0.65 * power, 0.9),
        decay: 0.0055 / power, // Lingering mud ripple
        lineWidth: 3.5 * power,
        hueShift: Math.random() * 20 - 10,
      });
    };

    // Listen to pointer events on the parent section
    const parentSection = document.getElementById("chat-and-map-section");

    const onPointerMove = (e: PointerEvent) => {
      if (!parentSection) return;
      const rect = parentSection.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      mousePos.current = { x, y, isInside: true };

      const now = performance.now();
      // Throttle ripple creation for realistic mud viscosity trail
      if (now - lastMoveTime.current > 75) {
        lastMoveTime.current = now;
        addRipple(x, y, 0.85);

        // Occasionally provoke a mud bubble when cursor stirs the mire
        if (Math.random() < 0.12) {
          spawnBubble(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30);
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!parentSection) return;
      const rect = parentSection.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Heavy mud squelch on click
      addRipple(x, y, 1.8);
      addRipple(x, y, 1.2);
      spawnBubble(x, y);
    };

    const onPointerLeave = () => {
      mousePos.current.isInside = false;
    };

    if (parentSection) {
      parentSection.addEventListener("pointermove", onPointerMove, { passive: true });
      parentSection.addEventListener("pointerdown", onPointerDown, { passive: true });
      parentSection.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }

    // Render loop for ripples
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw and advance ripples
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += r.speed;
        r.opacity -= r.decay;

        if (r.opacity <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();

        // 1. Shadow trough (mud depression)
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(1, r.radius - 2), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(12, 8, 4, ${r.opacity * 0.8})`;
        ctx.lineWidth = r.lineWidth * 1.5;
        ctx.stroke();

        // 2. Wet mud highlight ridge (slick peat reflection)
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(195, 168, 128, ${r.opacity * 0.55})`;
        ctx.lineWidth = r.lineWidth;
        ctx.stroke();

        // 3. Inner mossy silt tint
        ctx.beginPath();
        ctx.arc(r.x, r.y, Math.max(1, r.radius + 2), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(88, 110, 68, ${r.opacity * 0.35})`;
        ctx.lineWidth = r.lineWidth * 0.7;
        ctx.stroke();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (parentSection) {
        parentSection.removeEventListener("pointermove", onPointerMove);
        parentSection.removeEventListener("pointerdown", onPointerDown);
        parentSection.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }, [spawnBubble]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0 bg-[#120c07]"
      aria-hidden="true"
    >
      {/* ----------------------------------------------------------------- */}
      {/* 1. Deep Rainforest Mire Foundation Gradients (Peat, Silt & Clay)   */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,#2c1f14_0%,#18100a_45%,#0c0704_100%)] opacity-95" />
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_right,#1b2716_0%,#131a0e_35%,transparent_75%)] opacity-85" />
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_50%_40%,#352416_0%,transparent_60%)] opacity-55 mix-blend-screen" />

      {/* ----------------------------------------------------------------- */}
      {/* 2. Viscous Mud Layer Contours (Undulating Organic Soil Current)    */}
      {/* ----------------------------------------------------------------- */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40 mix-blend-overlay preserve-3d"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        <defs>
          <linearGradient id="mireGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4a3622" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#2c1f13" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#140d08" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="mireGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2a381d" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#1f180f" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0d0805" stopOpacity="0.85" />
          </linearGradient>
          <filter id="mudTurbulence">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.008"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>

        {/* Slow breathing mud contour wave 1 */}
        <motion.path
          d="M0,320 C320,260 480,380 720,330 C960,280 1160,370 1440,310 L1440,900 L0,900 Z"
          fill="url(#mireGradient1)"
          filter="url(#mudTurbulence)"
          animate={{
            d: [
              "M0,320 C320,260 480,380 720,330 C960,280 1160,370 1440,310 L1440,900 L0,900 Z",
              "M0,340 C340,380 460,270 740,350 C980,390 1140,290 1440,335 L1440,900 L0,900 Z",
              "M0,320 C320,260 480,380 720,330 C960,280 1160,370 1440,310 L1440,900 L0,900 Z",
            ],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Slow breathing mud contour wave 2 (Mossy Bog Sediment) */}
        <motion.path
          d="M0,520 C260,460 520,580 840,510 C1120,450 1280,560 1440,490 L1440,900 L0,900 Z"
          fill="url(#mireGradient2)"
          filter="url(#mudTurbulence)"
          animate={{
            d: [
              "M0,520 C260,460 520,580 840,510 C1120,450 1280,560 1440,490 L1440,900 L0,900 Z",
              "M0,495 C300,560 560,470 820,540 C1080,580 1320,460 1440,525 L1440,900 L0,900 Z",
              "M0,520 C260,460 520,580 840,510 C1120,450 1280,560 1440,490 L1440,900 L0,900 Z",
            ],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </svg>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Interactive Mud Ripple Canvas (Viscous Surface Waves)          */}
      {/* ----------------------------------------------------------------- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
      />

      {/* ----------------------------------------------------------------- */}
      {/* 4. Natural Mud / Methane Mire Bubbles (Swelling & Bursting)        */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-hidden">
        <AnimatePresence>
          {bubbles.map((b) => (
            <motion.div
              key={b.id}
              initial={{ scale: 0.1, opacity: 0 }}
              animate={{
                scale: [0.1, 1, 1.08, 1.15],
                opacity: [0, 0.9, 0.95, 0],
                y: [0, -3, -5, -8],
              }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{
                duration: 2.8,
                times: [0, 0.6, 0.85, 1],
                ease: "easeOut",
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: b.x,
                top: b.y,
                width: b.size,
                height: b.size,
              }}
              onAnimationComplete={() => {
                setBubbles((prev) => prev.filter((item) => item.id !== b.id));
              }}
            >
              {/* Viscous Mud Bubble Shell with Wet Specular Highlight */}
              <div
                className={`w-full h-full rounded-full bg-gradient-to-br ${b.colorTone} shadow-[0_4px_12px_rgba(0,0,0,0.85),inset_0_2px_4px_rgba(255,230,190,0.4),inset_0_-3px_6px_rgba(0,0,0,0.9)] border border-amber-900/30 relative flex items-start justify-start p-1 backdrop-blur-[1px]`}
              >
                {/* Wet specular light spot */}
                <div className="w-1.5 h-1.5 rounded-full bg-amber-100/80 shadow-[0_0_4px_rgba(255,255,255,0.9)] opacity-90" />
                <div className="w-0.5 h-0.5 rounded-full bg-white/70 ml-0.5 mt-0.5" />
              </div>

              {/* Mud pop ripple ring that expands outward when popping */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 2.2, opacity: [0, 0.5, 0] }}
                transition={{ duration: 0.7, delay: 2.1, ease: "easeOut" }}
                className="absolute inset-0 rounded-full border border-amber-200/30"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Drifting Forest Swamp Mist (Atmospheric Depth)                 */}
      {/* ----------------------------------------------------------------- */}
      <motion.div
        className="absolute -inset-x-20 top-0 h-full opacity-25 bg-[radial-gradient(ellipse_at_30%_50%,rgba(160,180,140,0.25)_0%,transparent_65%)] pointer-events-none filter blur-2xl"
        animate={{
          x: [-40, 40, -40],
          opacity: [0.18, 0.28, 0.18],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -inset-x-20 bottom-0 h-2/3 opacity-20 bg-[radial-gradient(ellipse_at_70%_70%,rgba(140,110,75,0.22)_0%,transparent_60%)] pointer-events-none filter blur-3xl"
        animate={{
          x: [35, -35, 35],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ----------------------------------------------------------------- */}
      {/* 6. Bioluminescent Forest Bog Spores & Firefly Micro-Specks        */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
        {spores.map((spore) => (
          <motion.div
            key={spore.id}
            initial={{
              x: 0,
              y: 0,
              opacity: 0,
            }}
            animate={{
              x: [0, spore.driftX, 0],
              y: [0, spore.driftY, 0],
              opacity: [0, 0.65, 0.2, 0.75, 0],
              scale: [0.8, 1.25, 0.9, 1.1, 0.8],
            }}
            transition={{
              duration: spore.duration,
              delay: spore.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${spore.x}%`,
              top: `${spore.y}%`,
              width: spore.size,
              height: spore.size,
              backgroundColor:
                spore.id % 2 === 0
                  ? "rgba(180, 220, 130, 0.75)" // Moss bio-glow
                  : "rgba(235, 190, 120, 0.65)", // Amber mire spore
              boxShadow:
                spore.id % 2 === 0
                  ? "0 0 8px rgba(180, 220, 130, 0.8)"
                  : "0 0 8px rgba(235, 190, 120, 0.7)",
            }}
          />
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 7. Wet Slick Mud Sheen & Vignette Frame                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(8,5,2,0.85)_100%)] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-[#2e8b57]/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-[#2e8b57]/30 to-transparent pointer-events-none" />
    </div>
  );
}
