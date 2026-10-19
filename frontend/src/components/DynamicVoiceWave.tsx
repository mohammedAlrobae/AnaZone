"use client";

import React from "react";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";

export type AgentState = "idle" | "listening" | "processing" | "speaking" | "error";

interface DynamicVoiceWaveProps {
  state: AgentState;
  volumeLevel: number;
  isMicMuted: boolean;
  onClick: () => void;
  statusLabel: string;
  hintLabel: string;
  actionLabel: string;
}

export default function DynamicVoiceWave({
  state,
  volumeLevel,
  isMicMuted,
  onClick,
  statusLabel,
  hintLabel,
  actionLabel,
}: DynamicVoiceWaveProps) {
  const listeningScale = 0.72 + Math.min(volumeLevel / 100, 1) * 0.48;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel}
      className="relative flex min-h-28 w-full items-center justify-between gap-4 overflow-hidden rounded-xl bg-black/25 hover:bg-black/35 px-4 text-left rtl:text-right transition-colors sm:px-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {/* Background wave ribbons in #2E8B57 */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d="M0 50 C95 50 128 28 220 43 C298 56 328 78 410 49 C496 18 532 12 612 47 C690 82 728 69 806 46 C881 24 923 50 1000 50 C923 50 881 76 806 54 C728 31 690 18 612 53 C532 88 496 82 410 51 C328 22 298 44 220 57 C128 72 95 50 0 50 Z"
          fill="#2E8B57"
          opacity="0.35"
          className={state === "speaking" ? "voice-ribbon voice-ribbon-one" : ""}
          style={state === "listening" ? { transform: `scaleY(${listeningScale})` } : undefined}
        />
        <path
          d="M0 50 C104 50 150 38 237 47 C313 55 356 67 431 49 C506 31 548 25 620 48 C701 71 747 63 820 48 C892 33 946 50 1000 50 C946 50 892 67 820 52 C747 37 701 29 620 52 C548 75 506 69 431 51 C356 33 313 45 237 53 C150 62 104 50 0 50 Z"
          fill="#2E8B57"
          opacity="0.5"
          className={state === "speaking" ? "voice-ribbon voice-ribbon-two" : ""}
          style={state === "listening" ? { transform: `scaleY(${listeningScale})` } : undefined}
        />
        <path
          d="M0 50 C124 50 172 44 258 49 C337 54 378 60 454 50 C532 40 575 35 650 50 C726 65 769 59 847 49 C918 40 960 50 1000 50 C960 50 918 60 847 51 C769 41 726 35 650 50 C575 65 532 60 454 50 C378 40 337 46 258 51 C172 56 124 50 0 50 Z"
          fill="#2E8B57"
          opacity="0.75"
          className={state === "speaking" ? "voice-ribbon voice-ribbon-three" : ""}
          style={state === "listening" ? { transform: `scaleY(${listeningScale})` } : undefined}
        />
      </svg>

      {/* Left / Start: Status icon & labels */}
      <div className="relative z-10 flex min-w-0 items-center gap-3.5 text-left rtl:text-right">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center text-white rounded-full transition-colors ${
            state === "processing" ? "bg-[#78866B] animate-pulse" : isMicMuted ? "bg-[#78866B]" : "bg-[#2E8B57]"
          }`}
        >
          {isMicMuted ? (
            <MicOff className="h-5 w-5 text-white" />
          ) : state === "processing" ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : state === "speaking" ? (
            <Volume2 className="h-5 w-5 text-white" />
          ) : (
            <Mic className="h-5 w-5 text-white" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-white leading-tight">{statusLabel}</span>
          {hintLabel && <span className="block text-xs font-semibold text-white/80 mt-0.5">{hintLabel}</span>}
        </span>
      </div>

      {/* Dynamic Sound Equalizer Bars (STRICTLY in color #2E8B57) */}
      <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 h-12 px-2 shrink-0">
        {[40, 75, 95, 60, 85, 50, 90, 65, 100, 70, 85, 45, 95, 55, 80, 60].map((h, i) => {
          const isBarActive = state === "listening" ? volumeLevel > 4 : state === "speaking";
          const scale =
            state === "listening"
              ? Math.max(0.2, (volumeLevel / 100) * (h / 65))
              : state === "speaking"
              ? Math.max(0.25, (Math.sin((i + 1) * 1.4) + 1.2) * 0.45)
              : 0.22;

          return (
            <span
              key={i}
              className={`w-1 sm:w-1.5 rounded-full transition-all duration-150 bg-[#2E8B57] ${
                isBarActive && state === "speaking" ? "animate-pulse" : ""
              }`}
              style={{
                height: `${h * 0.38}px`,
                transform: `scaleY(${scale})`,
                animationDelay: `${i * 60}ms`,
              }}
            />
          );
        })}
      </div>
    </button>
  );
}
