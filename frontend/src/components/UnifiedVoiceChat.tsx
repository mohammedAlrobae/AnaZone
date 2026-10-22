"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Volume2,
  VolumeX,
  Square,
  Loader2,
  Send,
  User,
  Mic,
  MicOff,
  Power,
  Sparkles,
  Trash2,
  CloudSun,
  Newspaper,
} from "lucide-react";
import { WavRecorder } from "@/lib/wavRecorder";
import {
  sendVoicePipeline,
  sendChatMessage,
  sendGreeting,
  transcribeVoiceChunk,
  ChatMessage,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocationSelected } from "./WorldMap";
import { LiveAgentWave } from "@/components/agents-ui/LiveAgentWave";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";

interface UnifiedVoiceChatProps {
  selectedVoice: string;
  messages: ChatMessage[];
  onSendMessage: (
    userText: string,
    botText: string,
    audioBase64?: string | null
  ) => void;
  onClearChat?: () => void;
  activeLocation: LocationSelected | null;
  agentSpeakingAudio?: string | null;
  onAgentSpeakingChange?: (speaking: boolean) => void;
}

type AgentState = "disconnected" | "connecting" | "ready" | "listening" | "thinking" | "speaking";

function mergeTranscript(previous: string, next: string): string {
  const previousWords = previous.trim().split(/\s+/).filter(Boolean);
  const nextWords = next.trim().split(/\s+/).filter(Boolean);
  const normalize = (word: string) =>
    word.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  const maxOverlap = Math.min(previousWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    const suffix = previousWords.slice(-overlap).map(normalize);
    const prefix = nextWords.slice(0, overlap).map(normalize);
    if (suffix.every((word, index) => word === prefix[index])) {
      return [...previousWords, ...nextWords.slice(overlap)].join(" ");
    }
  }

  return [...previousWords, ...nextWords].join(" ");
}

export default function UnifiedVoiceChat({
  selectedVoice,
  messages,
  onSendMessage,
  onClearChat,
  activeLocation,
  agentSpeakingAudio,
  onAgentSpeakingChange,
}: UnifiedVoiceChatProps) {
  // 1. Connection & Audio State (Logically Separated)
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [isAgentVoiceMuted, setIsAgentVoiceMuted] = useState<boolean>(false);
  const [state, setState] = useState<AgentState>("disconnected");

  // 2. UI & Messages State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [inputText, setInputText] = useState("");
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  // 3. LiveKit Cloud WebRTC
  const [liveKitToken, setLiveKitToken] = useState<string>("");
  const [liveKitUrl, setLiveKitUrl] = useState<string>("");
  const [isLiveKitConnected, setIsLiveKitConnected] = useState<boolean>(false);

  // References
  const isConnectedRef = useRef(false);
  const isMicActiveRef = useRef(false);
  const isAgentVoiceMutedRef = useRef(false);
  const recorderRef = useRef<WavRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const connectingLockRef = useRef(false);
  const transcriptionSessionRef = useRef(0);
  const partialTranscriptionBusyRef = useRef(false);
  const pendingPartialAudioRef = useRef<{ audioBase64: string; session: number } | null>(null);
  const liveTranscriptRef = useRef("");
  const greetingPendingRef = useRef(false);
  const hasGreetedRef = useRef(false);
  const processingRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => { });
  const resumeListeningRef = useRef<() => void>(() => { });
  const playingAudioIndexRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const { t, language } = useI18n();

  // Deduplicate consecutive identical messages and empty messages
  const dedupedMessages = useMemo(() => {
    const list: ChatMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg.content?.trim()) continue;
      const prev = list[list.length - 1];
      if (
        prev &&
        prev.role === msg.role &&
        prev.content.trim() === msg.content.trim()
      ) {
        continue;
      }
      list.push(msg);
    }
    return list;
  }, [messages]);

  const handleClearChatClick = useCallback(() => {
    hasGreetedRef.current = false;
    if (onClearChat) {
      onClearChat();
    }
  }, [onClearChat]);

  // Sync refs with state
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    isMicActiveRef.current = isMicActive;
  }, [isMicActive]);

  useEffect(() => {
    isAgentVoiceMutedRef.current = isAgentVoiceMuted;
  }, [isAgentVoiceMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => { });
      }
      if (currentAudioRef.current) {
        const audio = currentAudioRef.current;
        if (playPromiseRef.current) {
          playPromiseRef.current.then(() => audio.pause()).catch(() => { });
        } else {
          audio.pause();
        }
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Scroll messages (only when conversation messages are active)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages, isTextLoading]);

  const setAgentState = useCallback((newState: AgentState) => {
    setState(newState);
    if (onAgentSpeakingChange) {
      onAgentSpeakingChange(newState === "speaking");
    }
  }, [onAgentSpeakingChange]);

  const safelyPauseAudio = useCallback(() => {
    if (currentAudioRef.current) {
      const audio = currentAudioRef.current;
      if (playPromiseRef.current) {
        playPromiseRef.current
          .then(() => {
            audio.pause();
          })
          .catch(() => { });
      } else {
        audio.pause();
      }
      currentAudioRef.current = null;
    }
    playPromiseRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    safelyPauseAudio();
    playingAudioIndexRef.current = null;
    setPlayingAudioIndex(null);
    if (isConnectedRef.current) {
      setAgentState(isMicActiveRef.current ? "listening" : "ready");
    } else {
      setAgentState("disconnected");
    }
  }, [safelyPauseAudio, setAgentState]);

  const updateLiveTranscription = useCallback(async (
    audioBase64: string,
    session: number
  ) => {
    if (
      session !== transcriptionSessionRef.current ||
      !isMicActiveRef.current ||
      greetingPendingRef.current
    ) {
      return;
    }

    if (partialTranscriptionBusyRef.current) {
      pendingPartialAudioRef.current = { audioBase64, session };
      return;
    }

    partialTranscriptionBusyRef.current = true;
    let request: { audioBase64: string; session: number } | null = { audioBase64, session };
    try {
      while (request && request.session === transcriptionSessionRef.current) {
        try {
          const result = await transcribeVoiceChunk(request.audioBase64);
          if (
            result.text.trim() &&
            request.session === transcriptionSessionRef.current &&
            isMicActiveRef.current
          ) {
            const merged = mergeTranscript(liveTranscriptRef.current, result.text.trim());
            liveTranscriptRef.current = merged;
            setLiveTranscript(merged);
          }
        } catch (error: unknown) {
          console.error("Live Whisper transcription notice:", error);
        }

        request = pendingPartialAudioRef.current;
        pendingPartialAudioRef.current = null;
      }
    } finally {
      partialTranscriptionBusyRef.current = false;
      const pending = pendingPartialAudioRef.current;
      pendingPartialAudioRef.current = null;
      if (pending && pending.session === transcriptionSessionRef.current) {
        void updateLiveTranscription(pending.audioBase64, pending.session);
      }
    }
  }, []);

  const playAudio = useCallback((base64Data: string, messageIndex: number) => {
    // If user muted agent voice, do not play
    if (isAgentVoiceMutedRef.current) {
      return;
    }

    if (playingAudioIndexRef.current === messageIndex && currentAudioRef.current) {
      safelyPauseAudio();
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      setAgentState(isMicActiveRef.current ? "listening" : "ready");
      if (isMicActiveRef.current) resumeListeningRef.current();
      return;
    }

    safelyPauseAudio();

    setAgentState("speaking");
    playingAudioIndexRef.current = messageIndex;
    setPlayingAudioIndex(messageIndex);

    const audioSrc = base64Data.startsWith("data:")
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioSrc);
    currentAudioRef.current = audio;

    audio.onended = () => {
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      currentAudioRef.current = null;
      playPromiseRef.current = null;
      setAgentState(isMicActiveRef.current ? "listening" : "ready");
    };

    audio.onerror = () => {
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      currentAudioRef.current = null;
      playPromiseRef.current = null;
      setAgentState(isMicActiveRef.current ? "listening" : "ready");
    };

    const promise = audio.play();
    if (promise !== undefined) {
      playPromiseRef.current = promise;
      promise.catch((err) => {
        if ((err as Error)?.name !== "AbortError") {
          console.warn("Autoplay notice:", err);
        }
        playingAudioIndexRef.current = null;
        setPlayingAudioIndex(null);
        setAgentState(isMicActiveRef.current ? "listening" : "ready");
      });
    }
  }, [safelyPauseAudio, setAgentState]);

  useEffect(() => {
    if (agentSpeakingAudio) {
      setIsConnected(true);
      isConnectedRef.current = true;
      playAudio(agentSpeakingAudio, -1);
    }
  }, [agentSpeakingAudio, playAudio]);

  // Clean up audio and microphone on unmount / popup close
  useEffect(() => {
    return () => {
      safelyPauseAudio();
      if (recorderRef.current) {
        void recorderRef.current.stop();
        recorderRef.current = null;
      }
    };
  }, [safelyPauseAudio]);

  const startListening = useCallback(async () => {
    if (recorderRef.current) return true;
    const transcriptionSession = ++transcriptionSessionRef.current;
    pendingPartialAudioRef.current = null;
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    setErrorMessage(null);
    stopAudio();

    try {
      const recorder = new WavRecorder();
      recorderRef.current = recorder;
      setAgentState("listening");

      await recorder.start((vol) => {
        setVolumeLevel(vol);
      }, () => {
        if (isMicActiveRef.current && !greetingPendingRef.current) {
          window.setTimeout(() => stopListeningRef.current(), 0);
        }
      }, (audioBase64) => {
        void updateLiveTranscription(audioBase64, transcriptionSession);
      });
      return true;
    } catch (err: unknown) {
      console.error("Microphone error:", err);
      recorderRef.current = null;
      setIsMicActive(false);
      setAgentState(isConnectedRef.current ? "ready" : "disconnected");
      setErrorMessage("Could not access microphone.");
      return false;
    }
  }, [setAgentState, stopAudio, updateLiveTranscription]);

  const stopListeningAndProcess = useCallback(async () => {
    if (!recorderRef.current || processingRef.current) return;
    processingRef.current = true;

    try {
      setAgentState("thinking");
      setVolumeLevel(0);
      transcriptionSessionRef.current += 1;
      pendingPartialAudioRef.current = null;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      const { base64, hasSpeech } = await recorder.stop();

      if (!hasSpeech) {
        liveTranscriptRef.current = "";
        setLiveTranscript("");
        if (isMicActiveRef.current) {
          resumeListeningRef.current();
        } else {
          setAgentState(isConnectedRef.current ? "ready" : "disconnected");
        }
        return;
      }

      const locationContextStr = activeLocation
        ? `${activeLocation.name} (${activeLocation.country || ""}, lat: ${activeLocation.lat}, lng: ${activeLocation.lng})`
        : undefined;

      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendVoicePipeline({
        audioBase64: base64,
        voice: selectedVoice,
        history: historyPayload,
        isMuted: isAgentVoiceMutedRef.current,
        locationContext: locationContextStr,
      });

      if (!response.user_text && !response.bot_text) {
        if (isMicActiveRef.current) resumeListeningRef.current();
        else setAgentState(isConnectedRef.current ? "ready" : "disconnected");
        return;
      }

      onSendMessage(response.user_text, response.bot_text, response.audio_base64);
      liveTranscriptRef.current = "";
      setLiveTranscript("");

      if (response.audio_base64 && !isAgentVoiceMutedRef.current) {
        playAudio(response.audio_base64, messages.length + 1);
      } else if (isMicActiveRef.current) {
        resumeListeningRef.current();
      } else {
        setAgentState(isConnectedRef.current ? "ready" : "disconnected");
      }
    } catch (err: unknown) {
      console.error("Pipeline error:", err);
      setAgentState(isConnectedRef.current ? "ready" : "disconnected");
      setErrorMessage((err as Error)?.message || "Error processing voice request");
    } finally {
      processingRef.current = false;
    }
  }, [activeLocation, messages, onSendMessage, playAudio, selectedVoice, setAgentState]);

  useEffect(() => {
    stopListeningRef.current = () => {
      void stopListeningAndProcess();
    };
    resumeListeningRef.current = () => {
      if (!isMicActiveRef.current || recorderRef.current) return;
      window.setTimeout(() => {
        if (isMicActiveRef.current && !recorderRef.current) {
          void startListening();
        }
      }, 250);
    };
  }, [startListening, stopListeningAndProcess]);

  // Connect Agent Session (Separated from Mic)
  const connectAgent = async () => {
    if (connectingLockRef.current || isConnectedRef.current) return;
    connectingLockRef.current = true;
    setIsConnected(true);
    setAgentState("connecting");
    setErrorMessage(null);

    // Fetch LiveKit token in background
    try {
      const roomName = `anazone-${selectedVoice}`;
      const tokenRes = await fetch(`/api/livekit/token?room=${encodeURIComponent(roomName)}`);
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.token && tokenData.url) {
          setLiveKitToken(tokenData.token);
          setLiveKitUrl(tokenData.url);
          setIsLiveKitConnected(true);
        }
      }
    } catch (e) {
      console.warn("LiveKit connection notice:", e);
    }

    try {
      if (!hasGreetedRef.current && messages.length === 0) {
        hasGreetedRef.current = true;
        setAgentState("thinking");
        greetingPendingRef.current = true;
        const greeting = await sendGreeting({ voice: selectedVoice, language });
        greetingPendingRef.current = false;
        onSendMessage("", greeting.reply, greeting.audio_base64);

        if (greeting.audio_base64 && !isAgentVoiceMutedRef.current) {
          playAudio(greeting.audio_base64, 0);
        } else {
          setAgentState("ready");
        }
      } else {
        setAgentState("ready");
      }
    } catch (err: unknown) {
      console.error("Greeting notice:", err);
      greetingPendingRef.current = false;
      setAgentState("ready");
    } finally {
      connectingLockRef.current = false;
    }
  };

  // Disconnect Agent Session
  const disconnectAgent = async () => {
    safelyPauseAudio();
    if (recorderRef.current) {
      await recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsConnected(false);
    setIsMicActive(false);
    setIsLiveKitConnected(false);
    setAgentState("disconnected");
    setLiveTranscript("");
    setVolumeLevel(0);
  };

  // Microphone Toggle (Independent Control)
  const toggleMicrophone = async () => {
    if (!isConnectedRef.current) {
      await connectAgent();
      setIsMicActive(true);
      await startListening();
      return;
    }

    if (isMicActiveRef.current) {
      // User wants to mute/pause mic
      setIsMicActive(false);
      if (recorderRef.current) {
        const recorder = recorderRef.current;
        recorderRef.current = null;
        await recorder.stop();
        setVolumeLevel(0);
      }
      setLiveTranscript("");
      if (state === "listening") {
        setAgentState("ready");
      }
    } else {
      // User wants to unmute mic & speak
      setIsMicActive(true);
      if (state !== "thinking" && state !== "speaking") {
        await startListening();
      }
    }
  };

  // Agent Voice / Speaker Toggle (Independent Output Control)
  const toggleAgentVoice = () => {
    setIsAgentVoiceMuted((prev) => {
      const next = !prev;
      if (next) {
        safelyPauseAudio();
        if (state === "speaking") {
          setAgentState(isMicActiveRef.current ? "listening" : "ready");
        }
      }
      return next;
    });
  };

  // Send Text Message (Works in all states)
  const handleSendText = async (predefinedText?: string) => {
    const text = (predefinedText || inputText).trim();
    if (!text || isTextLoading) return;

    // Auto-connect if disconnected
    if (!isConnectedRef.current) {
      setIsConnected(true);
    }

    if (!predefinedText) {
      setInputText("");
    }
    setIsTextLoading(true);
    setAgentState("thinking");

    try {
      const locationContextStr = activeLocation
        ? `${activeLocation.name} (${activeLocation.country || ""}, lat: ${activeLocation.lat}, lng: ${activeLocation.lng})`
        : undefined;

      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage({
        message: text,
        voice: selectedVoice,
        history: historyPayload,
        isMuted: isAgentVoiceMutedRef.current,
        locationContext: locationContextStr,
      });

      onSendMessage(text, res.reply, res.audio_base64);

      if (res.audio_base64 && !isAgentVoiceMutedRef.current) {
        playAudio(res.audio_base64, messages.length + 1);
      } else {
        setAgentState(isMicActiveRef.current ? "listening" : "ready");
      }
    } catch (err: unknown) {
      console.error("Chat error:", err);
      onSendMessage(text, t.chatErrorNotice, null);
      setAgentState(isMicActiveRef.current ? "listening" : "ready");
    } finally {
      setIsTextLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 overflow-hidden bg-black/15 backdrop-blur-[3px] rounded-xl p-5 sm:p-6 flex flex-col relative text-white">
      {/* 1. Voice Agent Header: Single Interactive Connect / Disconnect Action Pill & Wave */}
      <div className="w-full shrink-0 flex flex-col items-center justify-center pt-0.5 pb-1">
        <div className="w-full flex items-center justify-center gap-2 mb-1.5">
          <button
            type="button"
            onClick={() => {
              if (isConnected) {
                void disconnectAgent();
              } else {
                void connectAgent();
              }
            }}
            disabled={state === "connecting"}
            title={
              !isConnected
                ? (language === "ar" ? "انقر للاتصال بالوكيل" : "Click to connect")
                : (language === "ar" ? "انقر لقطع الاتصال" : "Click to disconnect")
            }
            className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-all duration-200 cursor-pointer backdrop-blur-md outline-none select-none ${
              !isConnected
                ? "bg-white/5 hover:bg-white/10 border-white/15 text-white/90 hover:text-white hover:scale-105 active:scale-95"
                : state === "connecting"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 cursor-wait"
                : "bg-emerald-500/15 hover:bg-red-500/20 border-emerald-500/30 hover:border-red-500/40 text-emerald-300 hover:text-red-300 hover:scale-105 active:scale-95"
            }`}
          >
            {/* Status Indicator Dot */}
            <span
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                state === "disconnected"
                  ? "bg-[#ff2222] shadow-[0_0_8px_#ff2222]"
                  : state === "connecting"
                  ? "bg-[#1eff00] shadow-[0_0_8px_#1eff00] animate-pulse"
                  : state === "ready"
                  ? "bg-[#10b981] shadow-[0_0_8px_#10b981] group-hover:bg-red-400 group-hover:shadow-[0_0_8px_#ef4444]"
                  : state === "listening"
                  ? "bg-[#ff5500] shadow-[0_0_8px_#ff5500] animate-pulse"
                  : state === "thinking"
                  ? "bg-[#ff00e1] shadow-[0_0_8px_#ff00e1] animate-pulse"
                  : "bg-[#0026ff] shadow-[0_0_8px_#0026ff] animate-pulse"
              }`}
            />

            {/* Unified Text & Action */}
            <span className="text-[11px] sm:text-xs">
              {!isConnected ? (
                <span>{language === "ar" ? "اتصال" : "Connect"}</span>
              ) : state === "connecting" ? (
                <span>{language === "ar" ? "جارٍ الاتصال..." : "Connecting..."}</span>
              ) : (
                <>
                  <span className="group-hover:hidden">
                    {state === "ready"
                      ? (language === "ar" ? "متصل" : "Connected")
                      : state === "listening"
                      ? (language === "ar" ? "جارٍ الاستماع..." : "Listening...")
                      : state === "thinking"
                      ? (language === "ar" ? "جارٍ التفكير..." : "Thinking...")
                      : (language === "ar" ? "يتحدث..." : "Speaking...")}
                  </span>
                  <span className="hidden group-hover:inline">
                    {language === "ar" ? "قطع الاتصال" : "Disconnect"}
                  </span>
                </>
              )}
            </span>

            <Power
              className={`w-3 h-3 transition-colors ${
                !isConnected
                  ? "text-white/60 group-hover:text-white"
                  : "text-emerald-400 group-hover:text-red-400"
              }`}
            />
          </button>

          {/* Clear Chat Button */}
          {dedupedMessages.length > 0 && onClearChat && (
            <button
              type="button"
              onClick={handleClearChatClick}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-medium text-white/60 hover:text-white transition-all cursor-pointer outline-none hover:scale-105 active:scale-95"
              title={language === "ar" ? "مسح المحادثة" : "Clear Chat"}
            >
              <Trash2 className="w-3 h-3" />
              <span className="hidden sm:inline">{language === "ar" ? "مسح" : "Clear"}</span>
            </button>
          )}
        </div>

        {/* Live Agent Wave across full lateral width */}
        <div className="w-full h-[65px] sm:h-[75px] relative overflow-hidden flex items-center justify-center">
          <LiveAgentWave
            state={state}
            size="full"
            className="w-full h-full"
          />
        </div>

        {/* Horizontal white divider under wave */}
        <div className="w-full h-px bg-white/20 mt-1 shrink-0" />
      </div>

      {/* Error notice */}
      {errorMessage && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-[#8b3a3a] text-white text-xs font-normal">
          {errorMessage}
        </div>
      )}

      {/* 2. Messages Stream Area (Simple, Sleek, Deduplicated) */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-3 pr-1 space-y-2.5">
        {dedupedMessages.length === 0 && !liveTranscript && !isTextLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/50 select-none">
            <Sparkles className="w-5 h-5 mb-2 text-white/40" />
            <p className="text-xs text-white/80 font-medium">
              {language === "ar"
                ? "انقر على أي موقع في الخريطة أو تحدث لاستكشاف العالم"
                : "Click any place on the map or speak to explore"}
            </p>
            <p className="text-[11px] text-white/40 mt-1">
              {language === "ar"
                ? "سيرشدك الوكيل الصوتي فوراً"
                : "Your AI voice guide will brief you instantly"}
            </p>
          </div>
        ) : (
          dedupedMessages.map((msg, index) => {
            const isUser = msg.role === "user";
            const isAudioPlaying = playingAudioIndex === index;

            return (
              <div
                key={index}
                className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`group relative max-w-[85%] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed transition-all ${
                    isUser
                      ? "bg-zinc-800/90 border border-white/20 text-white rounded-2xl rounded-tr-none shadow-sm"
                      : "bg-white/10 backdrop-blur-md border border-white/15 text-white/95 rounded-2xl rounded-tl-none shadow-sm"
                  }`}
                  dir="auto"
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Sleek inline audio replay for assistant messages */}
                  {!isUser && msg.audioBase64 && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-white/40 font-mono">
                        {isAudioPlaying
                          ? (language === "ar" ? "جارٍ التشغيل..." : "Playing...")
                          : (language === "ar" ? "صوت الوكيل" : "Voice")}
                      </span>
                      <button
                        type="button"
                        onClick={() => playAudio(msg.audioBase64!, index)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-all cursor-pointer border ${
                          isAudioPlaying
                            ? "bg-blue-600/30 text-blue-200 border-blue-400/40"
                            : "bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border-white/15"
                        }`}
                      >
                        {isAudioPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current text-blue-300" />
                            <span>{t.stopAudio}</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-white/80" />
                            <span>{t.replayAudio}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {liveTranscript && (
          <div className="flex justify-end" aria-live="polite">
            <div className="max-w-[85%] rounded-xl bg-zinc-900/80 border border-white/20 px-4 py-3 text-sm leading-relaxed text-white">
              <p className="whitespace-pre-wrap" dir="auto">{liveTranscript}</p>
            </div>
          </div>
        )}

        {isTextLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-zinc-900 border border-white/20 text-white flex items-center justify-center shrink-0">
              <Volume2 className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-black/35 px-4 py-2.5 text-xs text-white flex items-center gap-2 rounded-xl rounded-tl-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              <span>{t.thinking}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Location Action Pills (Weather & News via LangGraph) */}
      {activeLocation && (
        <div className="flex items-center gap-2 mt-2 px-1 text-xs shrink-0">
          <button
            type="button"
            onClick={() => void handleSendText(language === "ar" ? "ما هي حالة الطقس الحالية هنا؟" : "What is the current weather here?")}
            disabled={isTextLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 text-[11px] transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
            <span>{language === "ar" ? "حالة الطقس" : "Live Weather"}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleSendText(language === "ar" ? "ما هي آخر الأخبار والمستجدات هنا؟" : "What are the latest news updates here?")}
            disabled={isTextLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 text-[11px] transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md"
          >
            <Newspaper className="w-3.5 h-3.5 text-amber-400" />
            <span>{language === "ar" ? "آخر الأخبار" : "Latest News"}</span>
          </button>
        </div>
      )}

      {/* 3. Bottom Controls & Text Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendText();
        }}
        dir="ltr"
        className="mt-3 p-1.5 rounded-xl bg-black/30 border border-white/20 flex items-center gap-1.5 focus-within:border-white/35 transition-colors"
      >
        {/* Control A: Microphone Button (User Voice Input) */}
        <button
          type="button"
          onClick={() => void toggleMicrophone()}
          disabled={state === "thinking"}
          aria-label={isMicActive ? "Mute Microphone" : "Unmute Microphone"}
          title={
            isMicActive
              ? (language === "ar" ? "الميكروفون قيد الاستماع (انقر للكتم)" : "Microphone Active (Click to mute)")
              : (language === "ar" ? "الميكروفون مكتوم (انقر للتحدث)" : "Microphone Muted (Click to talk)")
          }
          className={`p-2.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center outline-none focus:outline-none focus:ring-0 ${
            !isConnected
              ? "text-white/70 hover:text-white hover:bg-white/10"
              : isMicActive
              ? "bg-[#ff5500] text-white shadow-[0_0_12px_rgba(255,85,0,0.7)] animate-pulse"
              : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white"
          }`}
        >
          {isMicActive ? (
            <Mic className="w-4 h-4 text-white" />
          ) : (
            <MicOff className="w-4 h-4 text-white/80" />
          )}
        </button>

        {/* Control B: Agent Voice / Speaker Toggle (Agent Voice Output) */}
        <button
          type="button"
          onClick={toggleAgentVoice}
          aria-label={isAgentVoiceMuted ? "Unmute Agent Voice" : "Mute Agent Voice"}
          title={
            isAgentVoiceMuted
              ? (language === "ar" ? "صوت الوكيل مكتوم (وضع النص الصامت)" : "Agent Voice: MUTED (Silent text mode)")
              : (language === "ar" ? "صوت الوكيل مفعّل (انقر للكتم)" : "Agent Voice: ON (Click to mute)")
          }
          className={`p-2.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center outline-none focus:outline-none focus:ring-0 ${
            isAgentVoiceMuted
              ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
              : "text-white/70 hover:text-white hover:bg-white/10"
          }`}
        >
          {isAgentVoiceMuted ? (
            <VolumeX className="w-4 h-4 text-red-300" />
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>

        {/* Text Input Box */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={isTextLoading || state === "thinking"}
          className="flex-1 bg-transparent text-white placeholder-white/60 px-3 py-2 text-sm font-normal outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 border-none focus:border-none shadow-none"
          style={{ outline: "none", boxShadow: "none" }}
          dir="auto"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isTextLoading || state === "thinking"}
          className="bg-black hover:bg-zinc-800 border border-white/20 disabled:opacity-40 text-white p-2.5 rounded-lg cursor-pointer transition-colors shrink-0 outline-none focus:outline-none focus:ring-0 shadow-sm"
          title="Send"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>

      {/* Hidden LiveKit WebRTC Session Manager for Cloud Audio Transport */}
      {liveKitToken && (
        <LiveKitRoom
          token={liveKitToken}
          serverUrl={liveKitUrl}
          connect={isLiveKitConnected}
          audio={true}
          video={false}
          onConnected={() => {
            console.log("LiveKit Cloud WebRTC connected successfully");
          }}
          onDisconnected={() => {
            console.log("LiveKit Cloud WebRTC disconnected");
            setIsLiveKitConnected(false);
          }}
        >
          <RoomAudioRenderer />
        </LiveKitRoom>
      )}
    </div>
  );
}
