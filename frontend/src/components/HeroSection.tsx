"use client";

import React from "react";
import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface HeroSectionProps {
  onScrollToAgent: () => void;
}

export default function HeroSection({ onScrollToAgent }: HeroSectionProps) {
  const { t } = useI18n();

  return (
    <section className="relative w-full min-h-screen flex items-center overflow-hidden">
      {/* Background Image: confirmed.jpeg from frontend */}
      <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
        <Image
          src="/confirmed.jpeg"
          alt="Voice Companion Background"
          fill
          priority
          className="object-cover object-right sm:object-center"
          sizes="100vw"
        />
      </div>

      {/* Content strictly on the LEFT side so the panda on the right remains completely visible */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 w-full flex items-center pt-20 pb-12">
        <div className="max-w-xl text-left rtl:text-right">
          {/* Title in white words */}
          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
            {t.heroTitle}
          </h1>

          {/* Under this title words in white color */}
          <p className="text-lg sm:text-2xl text-white font-semibold leading-relaxed mb-10 max-w-lg">
            {t.heroSubtitle}
          </p>

          {/* Jump arrow to the voice agent section */}
          <div className="flex flex-col items-start rtl:items-start gap-3">
            <button
              onClick={onScrollToAgent}
              className="flex items-center gap-3 px-7 py-3.5 rounded-xl bg-[#2e8b57] text-white hover:bg-[#257347] font-extrabold text-base sm:text-lg transition-colors cursor-pointer"
              aria-label="Jump to voice agent section"
            >
              <span>{t.heroCta}</span>
              <ArrowDown className="w-5 h-5 shrink-0" />
            </button>
            <span className="text-white/90 text-xs font-semibold tracking-wide">
              {t.heroJumpHint}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
