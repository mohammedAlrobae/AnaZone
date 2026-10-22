"use client";

import React, { useState } from "react";
import { MessageSquare, X, Minus, Volume2, Sparkles, ChevronDown, Mic } from "lucide-react";
import UnifiedVoiceChat from "./UnifiedVoiceChat";
import { ChatMessage } from "@/lib/api";
import { LocationSelected } from "./WorldMap";
import { useI18n } from "@/lib/i18n";

interface PopupVoiceChatProps {
  selectedVoice: string;
  messages: ChatMessage[];
  onSendMessage: (userText: string, botText: string, audioBase64?: string | null) => void;
  onClearChat?: () => void;
  activeLocation: LocationSelected | null;
  agentSpeakingAudio: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PopupVoiceChat({
  selectedVoice,
  messages,
  onSendMessage,
  onClearChat,
  activeLocation,
  agentSpeakingAudio,
  isOpen,
  onOpenChange,
}: PopupVoiceChatProps) {
  const { language } = useI18n();

  // Auto-open chat popup when user clicks a location to explore or agent speaks
  React.useEffect(() => {
    if (activeLocation || agentSpeakingAudio) {
      setIsOpen(true);
    }
  }, [activeLocation, agentSpeakingAudio]);

  const formattedVoiceName = selectedVoice.charAt(0).toUpperCase() + selectedVoice.slice(1);

  return (
    <>
      {/* 1. Minimized Floating Launcher Bubble (Bottom Right) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce-subtle">
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="group relative flex items-center gap-3 bg-black/90 hover:bg-zinc-900 text-white pl-4 pr-5 py-3 rounded-full shadow-2xl border border-white/25 hover:border-white/50 transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xl"
            aria-label="Open AI Voice Chat"
          >
            {/* Glowing Pulse Rings */}
            <span className="absolute -inset-1 rounded-full bg-white/10 blur-md group-hover:bg-white/20 animate-pulse pointer-events-none" />

            {/* Agent Avatar Icon */}
            <div className="relative w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Mic className="w-4 h-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white border-2 border-black rounded-full animate-ping" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-white border-2 border-black rounded-full" />
            </div>

            {/* Launcher Text */}
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold tracking-wide text-white flex items-center gap-1.5">
                <span>{formattedVoiceName}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/15 text-white border border-white/20 font-medium">
                  AI
                </span>
              </span>
              <span className="text-[10px] text-white/70 font-normal">
                {language === "ar" ? "انقر للتحدث" : "Tap to talk & chat"}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* 2. Expanded Floating Pop-up Chatbot Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh] flex flex-col bg-black/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
          {/* Header Bar */}
          <div className="w-full bg-zinc-950 px-4 py-3 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-white border border-black" />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white tracking-wide">
                    {formattedVoiceName}
                  </span>
                  <span className="text-[10px] text-white/80 font-medium">• {language === "ar" ? "متصل" : "Online"}</span>
                </div>
                <span className="text-[10px] text-white/60">
                  {language === "ar" ? "المساعد الصوتي الذكي" : "AI Companion Explorer"}
                </span>
              </div>
            </div>

            {/* Close / Minimize Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                title={language === "ar" ? "تصغير المحادثة" : "Minimize Chat"}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                title={language === "ar" ? "إغلاق" : "Close"}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Unified Voice Chat Body */}
          <div className="relative flex-1 w-full min-h-0 overflow-hidden bg-transparent">
            <UnifiedVoiceChat
              selectedVoice={selectedVoice}
              messages={messages}
              onSendMessage={onSendMessage}
              onClearChat={onClearChat}
              activeLocation={activeLocation}
              agentSpeakingAudio={agentSpeakingAudio}
            />
          </div>
        </div>
      )}
    </>
  );
}
