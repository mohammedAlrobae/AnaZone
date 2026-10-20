"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { getVoiceSampleUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
}

interface VoiceProfileItem {
  id: string;
  name: string;
  role: string;
  description: string;
  categoryTag: string;
  gradient: string;
  glowColor: string;
  accentColor: string;
  innerShadow: string;
}

export default function VoiceSelector({
  selectedVoice,
  onSelectVoice,
}: VoiceSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { t, language } = useI18n();

  const isRtl = language === "ar";

  const voices: VoiceProfileItem[] = [
    {
      id: "yasmin",
      name: t.yasminName,
      role: t.yasminRole,
      description: t.yasminDesc,
      categoryTag: isRtl ? "احترافي • هادئ" : "Professional • Calm",
      // Iridescent pearlescent amethyst / violet / sky-cyan
      gradient: "radial-gradient(circle at 35% 30%, #ffffff 0%, #f3e8ff 18%, #d8b4fe 38%, #a855f7 62%, #4c1d95 85%, #1e1b4b 100%)",
      glowColor: "rgba(168, 85, 247, 0.45)",
      accentColor: "#a855f7",
      innerShadow: "inset 8px 8px 25px rgba(255, 255, 255, 0.7), inset -12px -12px 30px rgba(0, 0, 0, 0.5)",
    },
    {
      id: "ahmed",
      name: t.ahmedName,
      role: t.ahmedRole,
      description: t.ahmedDesc,
      categoryTag: isRtl ? "ودود • خدمة عملاء" : "Friendly • Conversational",
      // Luminous solar amber / glowing peach / flame orange (matching ElevenLabs center orb)
      gradient: "radial-gradient(circle at 35% 30%, #ffffff 0%, #ffedd5 18%, #fdba74 38%, #f97316 62%, #c2410c 85%, #431407 100%)",
      glowColor: "rgba(249, 115, 22, 0.55)",
      accentColor: "#f97316",
      innerShadow: "inset 8px 8px 25px rgba(255, 255, 255, 0.75), inset -12px -12px 30px rgba(0, 0, 0, 0.5)",
    },
    {
      id: "tareq",
      name: t.tareqName,
      role: t.tareqRole,
      description: t.tareqDesc,
      categoryTag: isRtl ? "حماسي • إعلاني" : "Energetic • Promotional",
      // Deep cosmic obsidian / twilight violet bronze / twilight glow
      gradient: "radial-gradient(circle at 35% 30%, #fef3c7 0%, #fde68a 15%, #d97706 35%, #78350f 60%, #1f2937 85%, #030712 100%)",
      glowColor: "rgba(217, 119, 6, 0.45)",
      accentColor: "#d97706",
      innerShadow: "inset 8px 8px 25px rgba(255, 255, 255, 0.65), inset -12px -12px 30px rgba(0, 0, 0, 0.6)",
    },
  ];

  // Stop audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const currentIndex = Math.max(
    0,
    voices.findIndex((v) => v.id === selectedVoice)
  );

  const prevIndex = (currentIndex - 1 + voices.length) % voices.length;
  const nextIndex = (currentIndex + 1) % voices.length;

  const currentVoice = voices[currentIndex];
  const leftVoice = voices[prevIndex];
  const rightVoice = voices[nextIndex];

  const handleSelect = (voiceId: string) => {
    onSelectVoice(voiceId);
  };

  const toggleAudition = (voiceId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // If already playing this voice, stop it
    if (playingVoice === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingVoice(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const sampleUrl = getVoiceSampleUrl(voiceId, language);
    const audio = new Audio(sampleUrl);
    audioRef.current = audio;
    setPlayingVoice(voiceId);

    audio.onended = () => {
      setPlayingVoice(null);
      audioRef.current = null;
    };

    audio.onerror = () => {
      setPlayingVoice(null);
      audioRef.current = null;
    };

    audio.play().catch((err) => {
      console.warn("Autoplay notice:", err);
      setPlayingVoice(null);
      audioRef.current = null;
    });
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newVoice = voices[prevIndex].id;
    handleSelect(newVoice);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newVoice = voices[nextIndex].id;
    handleSelect(newVoice);
  };

  const isCurrentPlaying = playingVoice === currentVoice.id;

  return (
    <div className="w-full select-none" dir="ltr">
      {/* SVG Fine Noise Grain Filter for the ElevenLabs Spheres */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          <filter id="eleven-sphere-grain" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.75"
              numOctaves="3"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.17 0"
              result="coloredNoise"
            />
            <feComposite in2="SourceGraphic" in="coloredNoise" operator="in" />
          </filter>
        </defs>
      </svg>

      {/* Main Stage (Cleanly floating directly on the section background - No blurry card) */}
      <div className="relative w-full flex flex-col items-center py-2 sm:py-4">
        {/* Subtle Ambient Glow matching the active voice */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none filter blur-3xl opacity-20 transition-all duration-700"
          style={{ backgroundColor: currentVoice.accentColor }}
        />

        {/* =======================================================
            1. The 3D Luminous Sphere Carousel (Strictly 3 Personas)
           ======================================================= */}
        <div className="relative w-full flex items-center justify-center gap-5 sm:gap-10 md:gap-16 py-4 sm:py-6 z-10">
          {/* Left Neighbor Orb */}
          <div
            onClick={() => handleSelect(leftVoice.id)}
            className="group relative flex flex-col items-center cursor-pointer transition-all duration-500 hover:scale-105 active:scale-95"
            title={`${leftVoice.name} - ${leftVoice.categoryTag}`}
          >
            <div
              className="w-20 h-20 sm:w-26 sm:h-26 md:w-32 md:h-32 rounded-full transition-all duration-500 relative opacity-75 group-hover:opacity-100"
              style={{
                background: leftVoice.gradient,
                boxShadow: `0 14px 35px -8px ${leftVoice.glowColor}, ${leftVoice.innerShadow}`,
              }}
            >
              {/* Grain Texture Overlay */}
              <div
                className="absolute inset-0 rounded-full mix-blend-overlay opacity-30 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 80%)",
                }}
              />
            </div>
            {/* Short Tag Below Neighbor Orb */}
            <span className="text-xs sm:text-sm font-normal text-white/80 mt-2.5 group-hover:text-white transition-colors drop-shadow-sm">
              {leftVoice.name}
            </span>
          </div>

          {/* Center Active Orb (Hero - Selected Persona) */}
          <div
            onClick={() => toggleAudition(currentVoice.id)}
            className="group relative flex flex-col items-center cursor-pointer transition-all duration-500 z-20"
            title={isCurrentPlaying ? (isRtl ? "إيقاف المعاينة" : "Pause Sample") : (isRtl ? "استمع لصوت العينة" : "Play Sample Audition")}
          >
            {/* Audio Ripples when Playing */}
            {isCurrentPlaying && (
              <div
                className="absolute inset-0 rounded-full animate-ping opacity-30 pointer-events-none"
                style={{ backgroundColor: currentVoice.accentColor }}
              />
            )}

            <div
              className={`w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-full transition-all duration-500 relative flex items-center justify-center ${
                isCurrentPlaying ? "scale-105" : "hover:scale-103"
              }`}
              style={{
                background: currentVoice.gradient,
                boxShadow: `0 22px 55px -10px ${currentVoice.glowColor}, ${currentVoice.innerShadow}`,
              }}
            >
              {/* Grain Texture Overlay */}
              <div
                className="absolute inset-0 rounded-full mix-blend-overlay opacity-35 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.5) 0%, transparent 75%)",
                }}
              />

              {/* Central White Glass Play / Pause Button */}
              <button
                type="button"
                onClick={(e) => toggleAudition(currentVoice.id, e)}
                aria-label={isCurrentPlaying ? "Pause audition" : "Play audition"}
                className="relative z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white text-gray-900 shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-115 active:scale-95 cursor-pointer"
              >
                {isCurrentPlaying ? (
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-gray-900 text-gray-900" />
                ) : (
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-gray-900 text-gray-900 ml-0.5" />
                )}
              </button>
            </div>
          </div>

          {/* Right Neighbor Orb */}
          <div
            onClick={() => handleSelect(rightVoice.id)}
            className="group relative flex flex-col items-center cursor-pointer transition-all duration-500 hover:scale-105 active:scale-95"
            title={`${rightVoice.name} - ${rightVoice.categoryTag}`}
          >
            <div
              className="w-20 h-20 sm:w-26 sm:h-26 md:w-32 md:h-32 rounded-full transition-all duration-500 relative opacity-75 group-hover:opacity-100"
              style={{
                background: rightVoice.gradient,
                boxShadow: `0 14px 35px -8px ${rightVoice.glowColor}, ${rightVoice.innerShadow}`,
              }}
            >
              {/* Grain Texture Overlay */}
              <div
                className="absolute inset-0 rounded-full mix-blend-overlay opacity-30 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, transparent 80%)",
                }}
              />
            </div>
            {/* Short Tag Below Neighbor Orb */}
            <span className="text-xs sm:text-sm font-normal text-white/80 mt-2.5 group-hover:text-white transition-colors drop-shadow-sm">
              {rightVoice.name}
            </span>
          </div>
        </div>

        {/* =======================================================
            2. Information Block Below the Active Persona
           ======================================================= */}
        <div className="relative z-10 w-full max-w-lg text-center space-y-1.5 mt-2">
          {/* Navigation Controls flanking the Persona Title */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous voice"
              className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => toggleAudition(currentVoice.id)}>
              <h3 className="text-lg sm:text-xl font-normal text-white tracking-tight">
                {currentVoice.name}
              </h3>
              <ArrowUpRight className="w-4 h-4 text-white/70" />
            </div>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Next voice"
              className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Persona Tagline Description */}
          <p
            className="text-white/85 text-xs sm:text-sm font-normal max-w-md mx-auto leading-relaxed px-4 drop-shadow-md"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {currentVoice.description}
          </p>
        </div>
      </div>
    </div>
  );
}
