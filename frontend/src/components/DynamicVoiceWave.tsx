"use client";

import React, { useRef, useEffect } from "react";

export type AgentState = "idle" | "listening" | "processing" | "speaking" | "error";

interface DynamicVoiceWaveProps {
  state: AgentState;
  volumeLevel: number;
  isMicMuted?: boolean;
  className?: string;
}

export default function DynamicVoiceWave({
  state,
  volumeLevel,
  isMicMuted = false,
  className = "",
}: DynamicVoiceWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Smooth interpolation reference values
  const currentAmpRef = useRef<number>(10);
  const volumeSmoothedRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.parentElement?.clientWidth || 400;
    let height = canvas.parentElement?.clientHeight || 90;

    const applyDpr = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      if (ctx.setTransform) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.resetTransform?.();
        ctx.scale(dpr, dpr);
      }
    };

    applyDpr(width, height);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        if (rect.width > 0 && rect.height > 0) {
          width = rect.width;
          height = rect.height;
          applyDpr(width, height);
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Layer definitions with distinct harmonic speeds, frequencies, and transparencies in sleek monochrome palette
    const layers = [
      {
        freq1: 0.009,
        freq2: 0.018,
        speed: 0.022,
        ampFactor: 0.65,
        colorTop: "rgba(255, 255, 255, 0.22)",
        colorBottom: "rgba(255, 255, 255, 0.04)",
        strokeColor: "rgba(255, 255, 255, 0.45)",
        lineWidth: 1.5,
      },
      {
        freq1: 0.013,
        freq2: 0.026,
        speed: 0.032,
        ampFactor: 0.85,
        colorTop: "rgba(255, 255, 255, 0.35)",
        colorBottom: "rgba(255, 255, 255, 0.08)",
        strokeColor: "rgba(255, 255, 255, 0.65)",
        lineWidth: 2,
      },
      {
        freq1: 0.016,
        freq2: 0.032,
        speed: 0.042,
        ampFactor: 1.05,
        colorTop: "rgba(255, 255, 255, 0.50)",
        colorBottom: "rgba(255, 255, 255, 0.12)",
        strokeColor: "rgba(255, 255, 255, 0.90)",
        lineWidth: 2.5,
      },
    ];

    let t = 0;

    const render = () => {
      if (width <= 0 || height <= 0) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth volume interpolation
      volumeSmoothedRef.current += (volumeLevel - volumeSmoothedRef.current) * 0.25;
      const smoothVol = volumeSmoothedRef.current;

      // Calculate dynamic target amplitude & speed based on state
      let targetAmp = 9; // Idle gentle baseline
      let speedMult = 1.0;

      if (state === "listening") {
        if (isMicMuted) {
          targetAmp = 4;
          speedMult = 0.5;
        } else {
          // Energetic real-time microphone reactivity
          targetAmp = 8 + Math.min(smoothVol * 0.45, 34);
          speedMult = 1.3 + Math.min(smoothVol / 60, 1.4);
        }
      } else if (state === "speaking") {
        // Natural speech rhythm with modulated cadence
        const speechEnvelope =
          (Math.sin(t * 3.8) * 0.5 + 0.5) * (Math.cos(t * 2.1) * 0.35 + 0.65);
        targetAmp = 15 + speechEnvelope * 22;
        speedMult = 2.0;
      } else if (state === "processing") {
        // Smooth circulating shimmer wave
        targetAmp = 12 + Math.sin(t * 5.2) * 4;
        speedMult = 2.4;
      } else if (state === "error") {
        targetAmp = 4;
        speedMult = 0.4;
      }

      // Smooth amplitude lerp for organic physical feel
      currentAmpRef.current += (targetAmp - currentAmpRef.current) * 0.14;
      const currentAmp = currentAmpRef.current;

      t += 0.02 * speedMult;
      const centerY = height / 2;

      // Render layered wave ribbons
      layers.forEach((layer, idx) => {
        ctx.beginPath();
        const step = 4;
        const effectiveAmp = currentAmp * layer.ampFactor;

        // Top edge of the ribbon
        for (let x = 0; x <= width; x += step) {
          const normX = x / width;
          // Taper envelope to zero at both sides
          const envelope = Math.pow(Math.sin(normX * Math.PI), 1.2);

          const w1 = Math.sin(x * layer.freq1 + t * layer.speed * 45 + idx * 1.6);
          const w2 = Math.cos(x * layer.freq2 - t * layer.speed * 28);
          const displacement = (w1 * 0.65 + w2 * 0.35) * effectiveAmp * envelope;

          const y = centerY - displacement;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Bottom edge of the ribbon (mirrored with harmonic offset)
        for (let x = width; x >= 0; x -= step) {
          const normX = x / width;
          const envelope = Math.pow(Math.sin(normX * Math.PI), 1.2);

          const w1 = Math.sin(x * layer.freq1 + t * layer.speed * 45 + idx * 1.6 + Math.PI);
          const w2 = Math.cos(x * layer.freq2 - t * layer.speed * 28 + Math.PI);
          const displacement = (w1 * 0.65 + w2 * 0.35) * (effectiveAmp * 0.85) * envelope;

          const y = centerY - displacement;
          ctx.lineTo(x, y);
        }

        ctx.closePath();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, centerY - effectiveAmp, 0, centerY + effectiveAmp);
        gradient.addColorStop(0, layer.colorTop);
        gradient.addColorStop(1, layer.colorBottom);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Highlight stroke along crest
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.lineWidth;
        ctx.stroke();
      });

      // Luminous center beam that pulses gently through the wave core
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const normX = x / width;
        const envelope = Math.pow(Math.sin(normX * Math.PI), 1.4);
        const y = centerY + Math.sin(x * 0.018 + t * 1.6) * (currentAmp * 0.35) * envelope;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [state, volumeLevel, isMicMuted]);

  return (
    <div
      className={`relative w-full h-24 overflow-hidden rounded-xl bg-black/25 backdrop-blur-[2px] flex items-center justify-center ${className}`}
      aria-label="Voice Agent Live Wave"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none select-none"
      />
    </div>
  );
}
