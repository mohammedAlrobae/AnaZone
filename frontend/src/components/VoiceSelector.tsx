"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getVoiceSampleUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import FluidVoiceCircle, { FluidVoiceColors } from "@/components/FluidVoiceCircle";

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
  fluidColors: FluidVoiceColors;
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
      // Azure Electric Blue with silky white swimming fluid wave (as shown in uploaded photo)
      fluidColors: {
        bgFrom: "#1d4ed8",
        bgTo: "#2563eb",
        waveColor: "rgba(255, 255, 255, 0.95)",
        secondaryWave: "rgba(191, 219, 254, 0.8)",
        glow: "rgba(37, 99, 235, 0.55)",
        accent: "#3b82f6",
      },
    },
    {
      id: "ahmed",
      name: t.ahmedName,
      role: t.ahmedRole,
      description: t.ahmedDesc,
      categoryTag: isRtl ? "ودود • خدمة عملاء" : "Friendly • Conversational",
      // Radiant Solar Coral/Flame with glowing white swimming fluid wave
      fluidColors: {
        bgFrom: "#c2410c",
        bgTo: "#ea580c",
        waveColor: "rgba(255, 255, 255, 0.95)",
        secondaryWave: "rgba(254, 215, 170, 0.8)",
        glow: "rgba(234, 88, 12, 0.55)",
        accent: "#f97316",
      },
    },
    {
      id: "tareq",
      name: t.tareqName,
      role: t.tareqRole,
      description: t.tareqDesc,
      categoryTag: isRtl ? "حماسي • إعلاني" : "Energetic • Promotional",
      // Deep Cosmic Emerald/Teal with glowing white swimming fluid wave
      fluidColors: {
        bgFrom: "#0f766e",
        bgTo: "#0d9488",
        waveColor: "rgba(255, 255, 255, 0.95)",
        secondaryWave: "rgba(153, 246, 228, 0.8)",
        glow: "rgba(13, 148, 136, 0.55)",
        accent: "#14b8a6",
      },
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

  const stopAudition = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setPlayingVoice(null);
  };

  const playVoiceAudition = (voiceId: string) => {
    stopAudition();

    const sampleUrl = getVoiceSampleUrl(voiceId, language);
    const audio = new Audio(sampleUrl);
    audioRef.current = audio;
    setPlayingVoice(voiceId);

    audio.onended = () => {
      if (audioRef.current === audio) {
        setPlayingVoice(null);
        audioRef.current = null;
      }
    };

    audio.onerror = () => {
      if (audioRef.current === audio) {
        setPlayingVoice(null);
        audioRef.current = null;
      }
    };

    audio.play().catch((err) => {
      console.warn("Autoplay notice:", err);
      if (audioRef.current === audio) {
        setPlayingVoice(null);
        audioRef.current = null;
      }
    });
  };

  const handleSelect = (newVoiceId: string) => {
    if (newVoiceId === selectedVoice) return;

    // Check if previous persona was actively playing
    const wasPlaying = Boolean(playingVoice || audioRef.current);

    // Immediately stop any currently playing voice
    stopAudition();

    // Select the new voice
    onSelectVoice(newVoiceId);

    // If audio was playing, seamlessly start the new voice's audition immediately
    if (wasPlaying) {
      playVoiceAudition(newVoiceId);
    }
  };

  const toggleAudition = (voiceId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    // If already playing this voice, stop it
    if (playingVoice === voiceId && audioRef.current) {
      stopAudition();
      return;
    }

    playVoiceAudition(voiceId);
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

  // Keyboard navigation for Left / Right arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const newVoice = isRtl ? voices[nextIndex].id : voices[prevIndex].id;
        handleSelect(newVoice);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const newVoice = isRtl ? voices[prevIndex].id : voices[nextIndex].id;
        handleSelect(newVoice);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, prevIndex, nextIndex, playingVoice, isRtl]);

  const isCurrentPlaying = playingVoice === currentVoice.id;

  return (
    <div className="w-full select-none" dir="ltr">
      {/* SVG Fine Noise Grain Filter for the ElevenLabs Spheres */}
      {/* Main Stage */}
      <div className="relative w-full flex flex-col items-center py-2 sm:py-4">
        {/* Subtle Ambient Glow matching the active voice */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none filter blur-3xl opacity-25 transition-all duration-700"
          style={{ backgroundColor: currentVoice.fluidColors.accent }}
        />

        {/* =======================================================
            1. Dynamic Fluid Voice Circles (GPT & ElevenLabs Motion)
           ======================================================= */}
        <div className="relative w-full flex items-center justify-center gap-6 sm:gap-12 md:gap-16 py-4 sm:py-6 z-10">
          {/* Left Neighbor Circle */}
          <FluidVoiceCircle
            id={leftVoice.id}
            name={leftVoice.name}
            categoryTag={leftVoice.categoryTag}
            isSelected={false}
            isPlaying={playingVoice === leftVoice.id}
            colors={leftVoice.fluidColors}
            size="neighbor"
            onSelect={() => handleSelect(leftVoice.id)}
            onTogglePlay={(e) => toggleAudition(leftVoice.id, e)}
          />

          {/* Center Active Hero Circle */}
          <FluidVoiceCircle
            id={currentVoice.id}
            name={currentVoice.name}
            categoryTag={currentVoice.categoryTag}
            isSelected={true}
            isPlaying={isCurrentPlaying}
            colors={currentVoice.fluidColors}
            size="hero"
            onSelect={() => toggleAudition(currentVoice.id)}
            onTogglePlay={(e) => toggleAudition(currentVoice.id, e)}
            playAriaLabel={isRtl ? "استمع لصوت العينة" : "Play sample"}
            pauseAriaLabel={isRtl ? "إيقاف المعاينة" : "Pause sample"}
          />

          {/* Right Neighbor Circle */}
          <FluidVoiceCircle
            id={rightVoice.id}
            name={rightVoice.name}
            categoryTag={rightVoice.categoryTag}
            isSelected={false}
            isPlaying={playingVoice === rightVoice.id}
            colors={rightVoice.fluidColors}
            size="neighbor"
            onSelect={() => handleSelect(rightVoice.id)}
            onTogglePlay={(e) => toggleAudition(rightVoice.id, e)}
          />
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

            <div className="flex items-center cursor-pointer" onClick={() => toggleAudition(currentVoice.id)}>
              <h3 className="text-lg sm:text-xl font-medium text-white tracking-tight drop-shadow-md">
                {currentVoice.name}
              </h3>
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

          {/* Persona Tagline Description - Solid white for high contrast and readability */}
          <p
            className="text-white text-xs sm:text-sm font-medium max-w-md mx-auto leading-relaxed px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            dir={isRtl ? "rtl" : "ltr"}
          >
            {currentVoice.description}
          </p>
        </div>
      </div>
    </div>
  );
}
