"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Volume2, VolumeX, Square, Loader2 } from "lucide-react";
import { WavRecorder } from "@/lib/wavRecorder";
import { streamVoicePipeline } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface VoiceAgentAreaProps {
  selectedVoice: string;
  isMuted: boolean;
  onToggleMute: () => void;
  history: { role: string; content: string }[];
  onNewMessage: (userText: string, botText: string, audioBase64?: string | null) => void;
}

type AgentState = "idle" | "listening" | "processing" | "speaking" | "error";

export default function VoiceAgentArea({
  selectedVoice,
  isMuted,
  onToggleMute,
  history,
  onNewMessage,
}: VoiceAgentAreaProps) {
  const [state, setState] = useState<AgentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [activeSpeechText, setActiveSpeechText] = useState<string>("");
  const [streamingReply, setStreamingReply] = useState<string>("");

  const recorderRef = useRef<WavRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const { t } = useI18n();

  const voiceDisplayNames: Record<string, string> = {
    yasmin: t.yasminName,
    ahmed: t.ahmedName,
    tareq: t.tareqName,
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => {});
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  const startListening = async () => {
    setErrorMessage(null);
    // Immediate barge-in: kill any active audio playback to prevent acoustic feedback loop
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setActiveSpeechText("");

    try {
      const recorder = new WavRecorder();
      recorderRef.current = recorder;
      setState("listening");

      await recorder.start((vol) => {
        setVolumeLevel(vol);
      });
    } catch (err: unknown) {
      console.error("Microphone error:", err);
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        await recorder.stop().catch((cleanupError: unknown) => {
          console.error("Microphone cleanup error:", cleanupError);
        });
      }
      setState("error");
      setErrorMessage("Could not access microphone. Please check browser permissions.");
    }
  };

  const stopListeningAndProcess = async () => {
    if (!recorderRef.current || state !== "listening") return;

    try {
      setState("processing");
      setVolumeLevel(0);
      const { base64, hasSpeech } = await recorderRef.current.stop();
      recorderRef.current = null;

      // Smart Voice Activity Detection (VAD) guard
      if (!hasSpeech) {
        setState("idle");
        setErrorMessage(t.noSpeechError);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      // Stream Cloudflare Whisper transcription and Groq response before Hugging Face TTS.
      setStreamingReply("");
      const response = await streamVoicePipeline(
        {
          audioBase64: base64,
          voice: selectedVoice,
          history,
          isMuted,
        },
        (token) => setStreamingReply((previous) => previous + token),
        (transcript) => onNewMessage(transcript, "")
      );

      if (!response.user_text && !response.bot_text) {
        setState("idle");
        return;
      }

      onNewMessage("", response.bot_text, response.audio_base64);
      setStreamingReply("");
      setActiveSpeechText(response.bot_text);

      // Play audio response if returned and not muted
      if (response.audio_base64 && !isMuted) {
        playAudioReply(response.audio_base64);
      } else {
        setState("idle");
      }
    } catch (err: unknown) {
      console.error("Pipeline error:", err);
      setStreamingReply("");
      onNewMessage("", t.chatErrorNotice, null);
      setState("error");
      setErrorMessage((err as Error)?.message || "Error processing voice request");
    }
  };

  const playAudioReply = (base64Data: string) => {
    setState("speaking");
    const audioSrc = base64Data.startsWith("data:")
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioSrc);
    currentAudioRef.current = audio;

    audio.onended = () => {
      setState("idle");
      setActiveSpeechText("");
    };

    audio.onerror = () => {
      setState("idle");
      setActiveSpeechText("");
    };

    audio.play().catch((err) => {
      console.warn("Autoplay notice:", err);
      setState("idle");
    });
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setState("idle");
    setActiveSpeechText("");
  };

  return (
    <div className="w-full bg-white text-gray-900 rounded-3xl p-8 shadow-xl border border-gray-200 flex flex-col justify-between h-[580px]">
      {/* Top Status & Mute Control */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              state === "listening"
                ? "bg-red-500 animate-ping"
                : state === "processing"
                ? "bg-[#78866B] animate-pulse"
                : state === "speaking"
                ? "bg-[#2e8b57] animate-bounce"
                : "bg-green-500"
            }`}
          />
          <div>
            <span className="font-extrabold text-sm text-gray-900 block">
              {state === "idle" && t.statusIdle}
              {state === "listening" && t.statusListening}
              {state === "processing" && t.statusProcessing}
              {state === "speaking" && t.statusSpeaking}
              {state === "error" && t.statusError}
            </span>
            <span className="text-xs text-[#2e8b57] font-bold">
              {t.outputVoiceLabel}: {voiceDisplayNames[selectedVoice] || selectedVoice}
            </span>
          </div>
        </div>

        {/* Mute Button Toggle */}
        <button
          onClick={onToggleMute}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs border ${
            isMuted
              ? "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
              : "bg-[#2e8b57] text-white border-[#2e8b57] hover:bg-[#78866B]"
          }`}
          title={isMuted ? t.voiceMutedTooltip : t.voiceActiveTooltip}
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4 text-gray-500" />
              <span>{t.voiceMuted}</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>{t.voiceActive}</span>
            </>
          )}
        </button>
      </div>

      {/* Center Interactive Circle */}
      <div className="flex flex-col items-center justify-center my-auto py-4">
        <div className="relative flex items-center justify-center">
          {/* Wave ripple when listening */}
          {state === "listening" && (
            <div
              className="absolute w-44 h-44 rounded-full bg-[#2e8b57]/20 animate-ping"
              style={{
                transform: `scale(${1 + Math.min(volumeLevel / 50, 0.5)})`,
              }}
            />
          )}

          {streamingReply && (
            <div className="mt-2 max-w-sm text-center px-4 py-2 text-xs text-gray-600" aria-live="polite">
              {streamingReply}
            </div>
          )}

          {/* Large Circle Button */}
          <div
            className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              state === "listening"
                ? "bg-red-500 text-white ring-8 ring-red-200"
                : state === "processing"
                ? "bg-[#78866B] text-white ring-8 ring-[#78866B]/30 animate-pulse"
                : state === "speaking"
                ? "bg-[#2e8b57] text-white ring-8 ring-[#2e8b57]/30"
                : "bg-[#2e8b57] text-white hover:bg-[#78866B] hover:scale-105"
            }`}
          >
            {state === "idle" && (
              <button
                onClick={startListening}
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer group text-white"
                aria-label={t.clickToTalk}
              >
                <Mic className="w-12 h-12 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-xs font-black mt-1">{t.clickToTalk}</span>
              </button>
            )}

            {state === "listening" && (
              <button
                onClick={stopListeningAndProcess}
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-white"
                aria-label={t.sendVoice}
              >
                <Square className="w-10 h-10 fill-current animate-pulse" />
                <span className="text-xs font-black mt-1">{t.sendVoice}</span>
              </button>
            )}

            {state === "processing" && (
              <div className="flex flex-col items-center justify-center text-white">
                <Loader2 className="w-10 h-10 animate-spin" />
                <span className="text-xs font-bold mt-1">{t.thinking}</span>
              </div>
            )}

            {state === "speaking" && (
              <button
                onClick={stopSpeaking}
                className="w-full h-full flex flex-col items-center justify-center cursor-pointer text-white"
                aria-label={t.stopVoice}
              >
                <Square className="w-8 h-8 fill-current" />
                <span className="text-xs font-black mt-1">{t.stopVoice}</span>
              </button>
            )}
          </div>
        </div>

        {/* Audio Waveform Bars */}
        <div className="flex items-center justify-center gap-1.5 h-12 mt-8">
          {[35, 70, 95, 60, 85, 45, 80, 55, 90, 50, 75].map((h, i) => {
            const isBarActive =
              state === "listening"
                ? volumeLevel > 5
                : state === "speaking";

            const scale =
              state === "listening"
                ? Math.max(0.2, (volumeLevel / 100) * (h / 70))
                : state === "speaking"
                ? (Math.sin(i * 1.3) + 1.2) * 0.5
                : 0.2;

            return (
              <span
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isBarActive ? "bg-[#2e8b57]" : "bg-gray-200"
                } ${state === "speaking" ? "animate-pulse" : ""}`}
                style={{
                  height: `${h * 0.4}px`,
                  transform: `scaleY(${scale})`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            );
          })}
        </div>

        {/* Live speech preview if speaking */}
        {activeSpeechText && (
          <div className="mt-4 max-w-sm text-center px-4 py-2.5 rounded-2xl bg-[#2e8b57]/10 border border-[#2e8b57]/30 text-gray-800 text-xs font-semibold shadow-xs" dir="auto">
            &quot;{activeSpeechText}&quot;
          </div>
        )}

        {/* Error notice */}
        {errorMessage && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-bold border border-red-200">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div className="text-center text-xs text-gray-500 font-semibold pt-3 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{t.dspNoiseActive}</span>
        </div>
        <span>{t.micInputInfo}</span>
      </div>
    </div>
  );
}
