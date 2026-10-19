"use client";

import React, { useState, useRef, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { getVoiceSampleUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface VoiceSelectorProps {
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onSelectVoice,
}: VoiceSelectorProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { t, language } = useI18n();

  const voices = [
    {
      id: "yasmin",
      name: t.yasminName,
      role: t.yasminRole,
    },
    {
      id: "ahmed",
      name: t.ahmedName,
      role: t.ahmedRole,
    },
    {
      id: "tareq",
      name: t.tareqName,
      role: t.tareqRole,
    },
  ];

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleCardClick = (voiceId: string) => {
    onSelectVoice(voiceId);

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const sampleUrl = getVoiceSampleUrl(voiceId, language);
    const audio = new Audio(sampleUrl);
    audioRef.current = audio;
    setPlayingVoice(voiceId);

    audio.onended = () => {
      setPlayingVoice(null);
    };

    audio.onerror = () => {
      setPlayingVoice(null);
    };

    audio.play().catch((err) => {
      console.warn("Autoplay notice:", err);
      setPlayingVoice(null);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let targetIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetIndex = (index + 1) % voices.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetIndex = (index - 1 + voices.length) % voices.length;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleCardClick(voices[index].id);
      return;
    }

    if (targetIndex >= 0) {
      const nextVoice = voices[targetIndex];
      handleCardClick(nextVoice.id);
      const nextEl = document.getElementById(`voice-card-${nextVoice.id}`);
      nextEl?.focus();
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>{t.selectVoiceTitle}</span>
          </h2>
          <p className="text-white/95 text-sm mt-1 font-semibold">
            {t.selectVoiceSubtitle}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={t.selectVoiceTitle}
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
      >
        {voices.map((voice, index) => {
          const isSelected = selectedVoice === voice.id;
          const isPlaying = playingVoice === voice.id;

          return (
            <button
              key={voice.id}
              id={`voice-card-${voice.id}`}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => handleCardClick(voice.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`group relative text-left rtl:text-right p-5 rounded-xl transition-colors duration-200 cursor-pointer flex flex-col justify-between min-h-[135px] outline-none focus-visible:ring-2 focus-visible:ring-white ${
                isSelected
                  ? "bg-[#2E8B57] text-white"
                  : "bg-black/35 hover:bg-black/50 text-white"
              }`}
            >
              {/* Card Header: Avatar Initial & Name/Role */}
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-base shrink-0 transition-colors ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-[#2E8B57] text-white group-hover:bg-[#349b62]"
                    }`}
                  >
                    {voice.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-base text-white leading-tight truncate">
                      {voice.name}
                    </h3>
                    <span className="text-xs font-semibold text-white/85 block mt-0.5 truncate">
                      {voice.role}
                    </span>
                  </div>
                </div>

                {/* Speaker Audition Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-black/30 text-white/90 group-hover:bg-[#2E8B57] group-hover:text-white"
                  }`}
                  title={t.clickToAudition}
                >
                  <Volume2 className="w-4 h-4" />
                </div>
              </div>

              {/* Bottom Card Footer: Status Pill */}
              <div className="flex items-center justify-between pt-3 mt-auto text-xs font-bold w-full">
                <span className="text-white/90">
                  {isPlaying
                    ? t.playingSample
                    : isSelected
                    ? t.personaReady
                    : t.clickToAudition}
                </span>

                {isSelected ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold">
                    {t.activeBadge}
                  </span>
                ) : (
                  <span className="text-[11px] text-white/70 group-hover:text-white font-medium transition-colors">
                    {language === "ar" ? "استماع" : "Audition"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
