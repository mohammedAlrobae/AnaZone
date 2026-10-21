"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause } from "lucide-react";

export interface FluidVoiceColors {
  bgFrom: string;
  bgTo: string;
  waveColor: string;
  secondaryWave: string;
  glow: string;
  accent: string;
}

interface FluidVoiceCircleProps {
  id: string;
  name: string;
  categoryTag?: string;
  isSelected: boolean;
  isPlaying: boolean;
  colors: FluidVoiceColors;
  size?: "hero" | "neighbor";
  onSelect: () => void;
  onTogglePlay: (e: React.MouseEvent) => void;
  playAriaLabel?: string;
  pauseAriaLabel?: string;
}

export default function FluidVoiceCircle({
  name,
  isSelected,
  isPlaying,
  colors,
  size = "neighbor",
  onSelect,
  onTogglePlay,
  playAriaLabel = "Play sample",
  pauseAriaLabel = "Pause sample",
}: FluidVoiceCircleProps) {
  const [clickPulse, setClickPulse] = useState(0);

  const isHero = size === "hero";
  const diameterClass = isHero
    ? "w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52"
    : "w-22 h-22 sm:w-28 sm:h-28 md:w-34 md:h-34";

  const handleClick = (e: React.MouseEvent) => {
    setClickPulse((prev) => prev + 1);
    if (!isSelected) {
      onSelect();
    } else {
      onTogglePlay(e);
    }
  };

  // Speed up swimming motion when active or playing audio
  const animDuration = isPlaying ? 3 : isSelected ? 4.5 : 7.5;

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col items-center cursor-pointer select-none transition-all duration-300 ${
        isHero ? "z-20" : "z-10 opacity-80 hover:opacity-100"
      }`}
    >
      {/* ------------------------------------------------------------- */}
      {/* Dynamic Selection Ripple Ring when clicked or selected        */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {clickPulse > 0 && (
          <motion.div
            key={clickPulse}
            initial={{ scale: 0.95, opacity: 0.8 }}
            animate={{ scale: isHero ? 1.45 : 1.35, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border-2 pointer-events-none"
            style={{ borderColor: colors.accent }}
          />
        )}
      </AnimatePresence>

      {/* Persistent subtle glow aura for active selected persona */}
      {isSelected && (
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.45, 0.7, 0.45],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 rounded-full pointer-events-none filter blur-xl"
          style={{ backgroundColor: colors.glow }}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* Clean 2D Circle Container with Masked Swimming Fluid Motion    */}
      {/* ------------------------------------------------------------- */}
      <motion.div
        whileHover={{ scale: isHero ? 1.03 : 1.08 }}
        whileTap={{ scale: 0.93 }}
        transition={{ type: "spring", stiffness: 350, damping: 20 }}
        className={`relative ${diameterClass} rounded-full overflow-hidden flex items-center justify-center transition-shadow duration-500`}
        style={{
          boxShadow: isSelected
            ? `0 16px 40px -10px ${colors.glow}, 0 0 0 2px rgba(255,255,255,0.4)`
            : `0 8px 24px -6px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15)`,
        }}
      >
        {/* Base Solid/Gradient Background (Deep vibrant color on top) */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background: `linear-gradient(180deg, ${colors.bgFrom} 0%, ${colors.bgTo} 55%, ${colors.bgTo} 100%)`,
          }}
        />

        {/* Bottom Ambient Tint (Lighter tinted base as in the reference photo) */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none opacity-60"
          style={{
            background: `linear-gradient(to top, ${colors.secondaryWave} 0%, transparent 100%)`,
          }}
        />

        {/* ------------------------------------------------------------- */}
        {/* Dynamic Swimming Liquid Wave (Diagonal S-Curve as in Photo)   */}
        {/* ------------------------------------------------------------- */}
        <motion.div
          animate={{
            x: ["-18%", "14%", "-12%", "16%", "-18%"],
            y: ["-8%", "10%", "-6%", "8%", "-8%"],
            rotate: [-8, 7, -5, 6, -8],
            scale: [1, 1.08, 0.96, 1.05, 1],
          }}
          transition={{
            duration: animDuration,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-x-8 top-[32%] h-[68%] pointer-events-none"
        >
          <svg
            viewBox="0 0 240 160"
            className="w-full h-full filter blur-[7px] sm:blur-[9px] opacity-95"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`waveGrad-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="35%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="70%" stopColor={colors.secondaryWave} stopOpacity="0.75" />
                <stop offset="100%" stopColor={colors.bgTo} stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Smooth undulating liquid wave crest */}
            <motion.path
              fill={`url(#waveGrad-${name})`}
              animate={{
                d: [
                  "M 0,55 C 60,18 120,78 180,38 C 210,18 230,42 240,32 L 240,160 L 0,160 Z",
                  "M 0,38 C 70,68 110,22 170,58 C 205,75 225,35 240,48 L 240,160 L 0,160 Z",
                  "M 0,48 C 55,30 130,65 185,25 C 215,10 230,45 240,38 L 240,160 L 0,160 Z",
                  "M 0,55 C 60,18 120,78 180,38 C 210,18 230,42 240,32 L 240,160 L 0,160 Z",
                ],
              }}
              transition={{
                duration: animDuration,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </svg>
        </motion.div>

        {/* Secondary counter-swimming fluid highlight */}
        <motion.div
          animate={{
            x: ["14%", "-14%", "10%", "-10%", "14%"],
            y: ["6%", "-8%", "5%", "-6%", "6%"],
            opacity: [0.55, 0.85, 0.6, 0.9, 0.55],
            scale: [0.95, 1.12, 0.92, 1.08, 0.95],
          }}
          transition={{
            duration: animDuration * 1.3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -inset-x-6 top-[38%] h-[55%] pointer-events-none"
        >
          <svg
            viewBox="0 0 240 140"
            className="w-full h-full filter blur-[10px] sm:blur-[13px] mix-blend-screen opacity-70"
            preserveAspectRatio="none"
          >
            <motion.path
              fill="#ffffff"
              animate={{
                d: [
                  "M 0,45 Q 60,75 120,40 T 240,55 L 240,140 L 0,140 Z",
                  "M 0,60 Q 60,30 120,65 T 240,40 L 240,140 L 0,140 Z",
                  "M 0,45 Q 60,75 120,40 T 240,55 L 240,140 L 0,140 Z",
                ],
              }}
              transition={{
                duration: animDuration * 1.3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </svg>
        </motion.div>

        {/* Top Crisp Blue Rim Highlight (Preserves clean 2D circle boundary) */}
        <div className="absolute inset-0 rounded-full border border-white/25 pointer-events-none" />

        {/* ------------------------------------------------------------- */}
        {/* Center Minimal Glass Play / Pause Button                      */}
        {/* ------------------------------------------------------------- */}
        {isHero && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay(e);
            }}
            aria-label={isPlaying ? pauseAriaLabel : playAriaLabel}
            className="relative z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/25 hover:bg-black/35 text-white border border-white/40 shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white ml-0.5" />
            )}
          </button>
        )}
      </motion.div>
    </div>
  );
}
