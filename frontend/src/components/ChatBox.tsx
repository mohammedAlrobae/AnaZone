"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Trash2, Bot, User, Loader2, Pause, Volume2 } from "lucide-react";
import { ChatMessage, streamChatMessage } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ChatBoxProps {
  messages: ChatMessage[];
  selectedVoice: string;
  isMuted: boolean;
  onSendMessage: (userText: string, botText: string, audioBase64?: string | null) => void;
  onClearHistory: () => void;
}

export default function ChatBox({
  messages,
  selectedVoice,
  isMuted,
  onSendMessage,
  onClearHistory,
}: ChatBoxProps) {
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  const voiceDisplayNames: Record<string, string> = {
    yasmin: t.yasminName,
    ahmed: t.ahmedName,
    tareq: t.tareqName,
  };

  // Auto-scroll to bottom only when messages change
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, streamingReply]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");
    setIsLoading(true);
    setStreamingReply("");
    onSendMessage(text, "");

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await streamChatMessage(
        {
          message: text,
          voice: selectedVoice,
          history: historyPayload,
          isMuted,
        },
        (token) => setStreamingReply((previous) => previous + token)
      );

      onSendMessage("", res.reply, res.audio_base64);
      setStreamingReply("");

      if (res.audio_base64 && !isMuted) {
        playAudio(res.audio_base64, messages.length + 1);
      }
    } catch (err: unknown) {
      console.error("Chat error:", err);
      setStreamingReply("");
      onSendMessage("", t.chatErrorNotice, null);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (base64Data: string, messageIndex: number) => {
    if (playingAudioIndex === messageIndex && audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setPlayingAudioIndex(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audioSrc = base64Data.startsWith("data:")
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioSrc);
    audioPlayerRef.current = audio;
    setPlayingAudioIndex(messageIndex);

    audio.onended = () => {
      setPlayingAudioIndex(null);
    };

    audio.onerror = () => {
      setPlayingAudioIndex(null);
    };

    audio.play().catch(() => {
      setPlayingAudioIndex(null);
    });
  };

  return (
    <div className="w-full bg-white rounded-3xl shadow-xl flex flex-col h-[580px] overflow-hidden border border-gray-200">
      {/* Chat Top Header */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#2e8b57] text-white flex items-center justify-center font-bold shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-gray-900 text-base">
                {t.chatTitle}
              </h3>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#2e8b57]/10 text-[#2e8b57] border border-[#2e8b57]/20">
                {voiceDisplayNames[selectedVoice] || selectedVoice}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              {isMuted ? t.chatMutedMode : t.chatVoiceMode}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer border border-gray-200"
            title={t.clearBtn}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.clearBtn}</span>
          </button>
        )}
      </div>

      {/* Messages Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <div className="w-16 h-16 rounded-3xl bg-[#2e8b57]/10 text-[#2e8b57] flex items-center justify-center mb-3">
              <Bot className="w-8 h-8" />
            </div>
            <p className="font-extrabold text-gray-800 text-lg mb-1">
              {t.noMessagesTitle}
            </p>
            <p className="text-xs text-gray-600 max-w-sm mb-4">
              {t.noMessagesSubtitle}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {t.suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInputText(suggestion)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:border-[#2e8b57] hover:text-[#2e8b57] transition-colors cursor-pointer shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isPlaying = playingAudioIndex === idx;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  isUser ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                    isUser
                      ? "bg-gray-900 text-white"
                      : "bg-[#2e8b57] text-white"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl p-4 shadow-xs ${
                    isUser
                      ? "bg-[#2e8b57] text-white rounded-tr-none font-medium"
                      : "bg-white text-gray-900 rounded-tl-none border border-gray-200"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium" dir="auto">
                    {msg.content}
                  </p>

                  {/* Play audio button on assistant message */}
                  {!isUser && msg.audioBase64 && (
                    <button
                      onClick={() => playAudio(msg.audioBase64!, idx)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2e8b57]/10 hover:bg-[#2e8b57] text-[#2e8b57] hover:text-white font-bold text-xs transition-colors cursor-pointer border border-[#2e8b57]/30"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>{t.stopAudio}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{t.replayAudio} ({voiceDisplayNames[selectedVoice] || selectedVoice})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {streamingReply && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#2e8b57] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[82%] rounded-2xl rounded-tl-none border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap" dir="auto">
              {streamingReply}
              <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-[#2e8b57] align-middle" />
            </div>
          </div>
        )}

        {isLoading && !streamingReply && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#2e8b57] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-gray-200 text-gray-700 rounded-2xl rounded-tl-none p-4 flex items-center gap-2 shadow-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#2e8b57]" />
              <span className="text-xs font-bold">
                {t.synthesizingWith} {voiceDisplayNames[selectedVoice] || selectedVoice}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Area */}
      <form
        onSubmit={handleSend}
        className="p-4 bg-white border-t border-gray-200 flex items-center gap-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={isLoading}
          dir="auto"
          className="flex-1 px-5 py-3.5 bg-gray-50 border border-gray-300 rounded-2xl text-gray-900 text-sm focus:outline-none focus:border-[#2e8b57] focus:ring-2 focus:ring-[#2e8b57]/20 placeholder:text-gray-400 font-medium transition-all"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="flex items-center justify-center w-12 h-12 rounded-2xl bg-[#2e8b57] hover:bg-[#78866B] text-white font-bold transition-all shadow-md disabled:opacity-40 disabled:hover:bg-[#2e8b57] cursor-pointer"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
