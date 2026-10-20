"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VoiceSelector from "@/components/VoiceSelector";
import UnifiedVoiceChat from "@/components/UnifiedVoiceChat";
import WorldMap, { LocationSelected } from "@/components/WorldMap";
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

      {/* Section 3: Chat and Map Exploration Section (Background: for_chatANDmap.jpg) */}
      <section
        id="chat-and-map-section"
        className="relative w-full text-white py-14 sm:py-20 px-6 sm:px-10 lg:px-16 overflow-hidden"
      >
        {/* Background Image EXCLUSIVELY for Chat & Map (Aurora Borealis) */}
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-0">
          <Image
            src="/for_chatANDmap.jpg"
            alt="Chat and Map Section Background"
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/25" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-5 h-[580px] min-h-0 w-full">
              <UnifiedVoiceChat
                selectedVoice={selectedVoice}
                messages={messages}
                onSendMessage={handleNewMessage}
                activeLocation={selectedLocation}
                agentSpeakingAudio={agentSpeakingAudio}
              />
            </div>

            <div className="lg:col-span-7 h-[580px] min-h-0 w-full">
              <WorldMap
                onLocationSelect={handleLocationSelect}
                selectedLocation={selectedLocation}
                isExploring={isExploring}
              />
            </div>
          </div>
        </div>
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
