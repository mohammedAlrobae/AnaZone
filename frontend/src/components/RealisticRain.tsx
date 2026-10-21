"use client";

import React, { useEffect, useRef } from "react";

interface RealisticRainProps {
  intensity?: "light" | "medium" | "heavy";
  windAngleDeg?: number; // e.g. 10 deg slant
  className?: string;
}

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  thickness: number;
  layer: number; // 0: background (fine mist), 1: midground, 2: foreground (large & fast)
}

interface RainSplash {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  maxRadius: number;
  opacity: number;
  decay: number;
  speed: number;
}

interface RainParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  opacity: number;
  size: number;
}

export default function RealisticRain({
  intensity = "medium",
  windAngleDeg = 9,
  className = "",
}: RealisticRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    // Rain drop count based on intensity
    const dropCount =
      intensity === "light" ? 180 : intensity === "heavy" ? 480 : 320;

    const angleRad = (windAngleDeg * Math.PI) / 180;
    const windFactor = Math.tan(angleRad);

    // Initialize raindrops across 3 parallax depth layers
    const drops: Raindrop[] = [];

    const createDrop = (initialY = -1): Raindrop => {
      // 3 Layers: 50% background, 35% midground, 15% foreground
      const rand = Math.random();
      const layer = rand < 0.5 ? 0 : rand < 0.85 ? 1 : 2;

      let length: number;
      let speed: number;
      let opacity: number;
      let thickness: number;

      if (layer === 0) {
        // Distant gentle mist-like rain (slow & dreamy)
        length = 12 + Math.random() * 10;
        speed = 7 + Math.random() * 3.5;
        opacity = 0.2 + Math.random() * 0.15;
        thickness = 1;
      } else if (layer === 1) {
        // Midground steady gentle rain
        length = 22 + Math.random() * 14;
        speed = 11 + Math.random() * 4;
        opacity = 0.38 + Math.random() * 0.2;
        thickness = 1.25;
      } else {
        // Foreground clear raindrops (soft, natural fall)
        length = 36 + Math.random() * 18;
        speed = 15.5 + Math.random() * 5;
        opacity = 0.58 + Math.random() * 0.28;
        thickness = 1.7;
      }

      return {
        x: Math.random() * (width + Math.abs(windFactor) * height * 1.2) - (windFactor > 0 ? 0 : Math.abs(windFactor) * height),
        y: initialY === -1 ? Math.random() * height : -length - Math.random() * 30,
        length,
        speed,
        opacity,
        thickness,
        layer,
      };
    };

    for (let i = 0; i < dropCount; i++) {
      drops.push(createDrop());
    }

    // Splashes on the floor / bottom edge
    const splashes: RainSplash[] = [];
    const particles: RainParticle[] = [];

    const addSplash = (x: number, y: number, layer: number) => {
      if (layer === 0) return; // Background rain does not need prominent splashes

      if (splashes.length < 45) {
        splashes.push({
          x,
          y,
          radiusX: 1.5,
          radiusY: 0.6,
          maxRadius: 7 + Math.random() * 8 * (layer === 2 ? 1.4 : 1),
          opacity: 0.55 * (layer === 2 ? 1 : 0.7),
          decay: 0.045,
          speed: 0.8 + Math.random() * 0.5,
        });
      }

      // Micro droplet bounce particles
      const count = layer === 2 ? 2 + Math.floor(Math.random() * 3) : 1;
      for (let p = 0; p < count; p++) {
        if (particles.length > 70) break;
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 3 + windFactor * 1.5,
          vy: -1.5 - Math.random() * 3,
          gravity: 0.22,
          life: 0,
          maxLife: 14 + Math.random() * 10,
          opacity: 0.65,
          size: 1 + Math.random() * 1.2,
        });
      }
    };

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw and update raindrops
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];

        // Draw raindrop tapered streak
        const tailX = d.x;
        const tailY = d.y;
        const headX = d.x + windFactor * d.length;
        const headY = d.y + d.length;

        // Gradient for authentic rain drop head & tail
        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0, "rgba(255, 255, 255, 0)");
        grad.addColorStop(0.65, `rgba(235, 245, 255, ${d.opacity * 0.7})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${d.opacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = d.thickness;
        ctx.lineCap = "round";
        ctx.stroke();

        // Move raindrop
        d.y += d.speed;
        d.x += windFactor * d.speed;

        // Impact detection near bottom ground
        const impactY = height - 12 - (d.layer === 0 ? 30 : Math.random() * 20);
        if (d.y >= impactY) {
          if (Math.random() < 0.65) {
            addSplash(headX, Math.min(height - 4, headY), d.layer);
          }
          // Reset drop to top
          drops[i] = createDrop(0);
        } else if (d.x > width + 100 || (windFactor < 0 && d.x < -100)) {
          // Wrap horizontally if blown off side
          drops[i] = createDrop(0);
        }
      }

      // 2. Draw ground impact splashes (elliptical water ripples)
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radiusX += s.speed;
        s.radiusY += s.speed * 0.35; // Perspective compression
        s.opacity -= s.decay;

        if (s.opacity <= 0 || s.radiusX >= s.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radiusX, s.radiusY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${s.opacity * 0.75})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // 3. Draw micro splash bounce particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life++;

        const currentOpacity = p.opacity * (1 - p.life / p.maxLife);

        if (p.life >= p.maxLife || p.y > height) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [intensity, windAngleDeg]);

  return (
    <div
      className={`absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden z-20 ${className}`}
      aria-hidden="true"
    >
      {/* 1. Atmospheric rainy haze / ambient humidity */}
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-sky-950/15 via-transparent to-black/20 pointer-events-none" />

      {/* 2. Soft drifting rain mist cloud */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08)_0%,transparent_75%)] pointer-events-none" />

      {/* 3. High-Performance Hardware-Accelerated Rain Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
}
