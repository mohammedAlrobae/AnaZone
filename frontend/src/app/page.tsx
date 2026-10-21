"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VoiceSelector from "@/components/VoiceSelector";
import Google3DRealMap from "@/components/Google3DRealMap";
import PopupVoiceChat from "@/components/PopupVoiceChat";
import { LocationSelected } from "@/components/WorldMap";
import { ChatMessage, exploreLocation } from "@/lib/api";
import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const [selectedVoice, setSelectedVoice] = useState<string>("yasmin");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSelected | null>(null);
  const [agentSpeakingAudio, setAgentSpeakingAudio] = useState<string | null>(null);
  const [isExploring, setIsExploring] = useState<boolean>(false);

  const agentSectionRef = useRef<HTMLDivElement | null>(null);
  const { t, language } = useI18n();

  const scrollToAgentSection = () => {
    agentSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNewMessage = (
    userText: string,
    botText: string,
    audioBase64?: string | null
  ) => {
    setMessages((prev) => {
      const next = userText.trim()
        ? [...prev, { role: "user" as const, content: userText }]
        : prev;
      return [...next, { role: "assistant", content: botText, audioBase64 }];
    });
  };

  // Called when user clicks any place or coordinate on the dynamic World Map
  const handleLocationSelect = async (loc: LocationSelected) => {
    setSelectedLocation(loc);
    setIsExploring(true);
    setAgentSpeakingAudio(null);

    try {
      const res = await exploreLocation({
        locationName: loc.name,
        country: loc.country,
        city: loc.city,
        lat: loc.lat,
        lng: loc.lng,
        voice: selectedVoice,
        isMuted: false,
        language,
      });

      // Add educational exploration briefing to chat history
      const formattedContent = `${loc.name}\n\n${res.intro_text}`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: formattedContent,
          audioBase64: res.audio_base64,
        },
      ]);

      if (res.audio_base64) {
        setAgentSpeakingAudio(res.audio_base64);
      }
    } catch (err) {
      console.error("Explore location error:", err);
    } finally {
      setIsExploring(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col font-sans bg-[#2e8b57] text-white">
      {/* 1. Top Navbar: Logo, Language Toggle, ABOUT, CONTACT */}
      <Navbar />

      {/* 2. Hero Section: confirmed_bg.jpeg with panda on right, Title & words on left, jump arrow */}
      <HeroSection onScrollToAgent={scrollToAgentSection} />

      {/* Section 2: Voice Persona Selection Section (Background: for_selecting_section.jpg) */}
      <section
        id="voice-selection-section"
        ref={agentSectionRef}
        className="relative w-full text-white py-14 sm:py-20 px-6 sm:px-10 lg:px-16 overflow-hidden transition-all duration-300"
      >
        {/* Background Image EXCLUSIVELY for Voice Persona Selection */}
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0">
          <Image
            src="/for_selecting_section.jpg"
            alt="Voice Selection Section Background"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto space-y-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl sm:text-5xl font-normal text-white tracking-tight mb-3">
              {t.sectionTitle}
            </h2>
            <p className="text-white/95 font-normal text-base sm:text-lg leading-relaxed">
              {t.sectionSubtitle}
            </p>
          </div>

          <VoiceSelector
            selectedVoice={selectedVoice}
            onSelectVoice={setSelectedVoice}
          />
        </div>
      </section>

      {/* Section 3: The Real 3D Google Map IS the Section Background */}
      <section
        id="chat-and-map-section"
        className="relative w-full h-[88vh] min-h-[680px] max-h-[920px] overflow-hidden bg-black p-0 m-0"
      >
        {/* Full-Bleed 3D Map as the Section Background */}
        <div className="absolute inset-0 w-full h-full z-0">
          <Google3DRealMap
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
            isExploring={isExploring}
          />
        </div>

        {/* Floating Title Overlay on Top-Left of the 3D Map */}
        <div className="absolute top-5 left-5 z-20 pointer-events-none max-w-lg">
          <div className="bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 shadow-2xl pointer-events-auto space-y-0.5">
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{language === "ar" ? "استكشاف كوكب الأرض ثلاثي الأبعاد" : "3D Planet Earth & World Exploration"}</span>
            </h2>
            <p className="text-white/75 text-xs">
              {language === "ar"
                ? "خريطة تفاعلية حية بدقة 3D من Google Maps Platform"
                : "Interactive Photorealistic 3D Globe & Cities powered by Google Maps"}
            </p>
          </div>
        </div>

        {/* Floating Pop-Up Chatbot on the right (Opens & closes easily) */}
        <PopupVoiceChat
          selectedVoice={selectedVoice}
          messages={messages}
          onSendMessage={handleNewMessage}
          activeLocation={selectedLocation}
          agentSpeakingAudio={agentSpeakingAudio}
        />
      </section>

      <footer className="w-full bg-[#2E8B57] py-5 px-6 text-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="font-normal tracking-wide text-white">
            {t.footerBrand}
          </span>

          <div className="flex items-center gap-4 font-normal">
            <a
              href="mailto:moalrobae@gmail.com"
              className="flex items-center gap-1.5 text-white hover:text-[#2e8b57] transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>moalrobae@gmail.com</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
