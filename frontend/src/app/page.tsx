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
      const cleanUser = userText.trim();
      const cleanBot = botText.trim();
      let updated = [...prev];

      // Add user message if not empty and not an immediate duplicate
      if (cleanUser) {
        const lastMsg = updated[updated.length - 1];
        if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== cleanUser) {
          updated.push({ role: "user", content: cleanUser });
        }
      }

      // Add assistant response if not empty and not an immediate duplicate
      if (cleanBot) {
        const lastMsg = updated[updated.length - 1];
        if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.content !== cleanBot) {
          updated.push({ role: "assistant", content: cleanBot, audioBase64 });
        }
      }

      return updated;
    });
  };

  const handleClearChat = () => {
    setMessages([]);
    setAgentSpeakingAudio(null);
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

      setMessages((prev) => {
        const lastMsg = prev[prev.length - 1];
        // Prevent duplicate briefing if clicked the same place consecutively
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.content === formattedContent) {
          return prev;
        }
        return [
          ...prev,
          {
            role: "assistant",
            content: formattedContent,
            audioBase64: res.audio_base64,
          },
        ];
      });

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
    <main className="min-h-screen w-full flex flex-col font-sans bg-black text-white">
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

        {/* Top Fade from Hero Section */}
        <div className="absolute top-0 left-0 right-0 h-28 sm:h-40 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none z-10" />

        {/* Bottom Fade into 3D Map Section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 sm:h-48 bg-gradient-to-b from-transparent via-black/60 to-black pointer-events-none z-10" />

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

        {/* Top Fade from Voice Selection Section into Space Globe */}
        <div className="absolute top-0 left-0 right-0 h-28 sm:h-40 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none z-10" />

        {/* Floating Pop-Up Chatbot on the right (Opens & closes easily) */}
        <PopupVoiceChat
          selectedVoice={selectedVoice}
          messages={messages}
          onSendMessage={handleNewMessage}
          onClearChat={handleClearChat}
          activeLocation={selectedLocation}
          agentSpeakingAudio={agentSpeakingAudio}
        />
      </section>

      <footer className="w-full bg-black border-t border-white/10 py-5 px-6 text-white">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm">
          <span className="font-normal tracking-wide text-white/90">
            {t.footerBrand}
          </span>

          <div className="flex items-center gap-4 font-normal">
            <a
              href="mailto:moalrobae@gmail.com"
              className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
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
