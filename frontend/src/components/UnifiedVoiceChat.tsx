"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const processingRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => { });
  const resumeListeningRef = useRef<() => void>(() => { });
  const playingAudioIndexRef = useRef<number | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const { t, language } = useI18n();

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

  // Scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTextLoading, state]);

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
      if (isConnectedRef.current) {
        if (isMicActiveRef.current) {
          setAgentState("listening");
          resumeListeningRef.current();
        } else {
          setAgentState("ready");
        }
      } else {
        setAgentState("disconnected");
      }
    };

    audio.onerror = () => {
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      currentAudioRef.current = null;
      playPromiseRef.current = null;
      if (isConnectedRef.current) {
        if (isMicActiveRef.current) {
          setAgentState("listening");
          resumeListeningRef.current();
        } else {
          setAgentState("ready");
        }
      } else {
        setAgentState("disconnected");
      }
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
        if (isConnectedRef.current) {
          setAgentState(isMicActiveRef.current ? "listening" : "ready");
        } else {
          setAgentState("disconnected");
        }
      });
    }
  }, [safelyPauseAudio, setAgentState]);

  useEffect(() => {
    if (agentSpeakingAudio) {
      playAudio(agentSpeakingAudio, -1);
    }
  }, [agentSpeakingAudio, playAudio]);

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
      setAgentState("thinking");
      greetingPendingRef.current = true;
      const greeting = await sendGreeting({ voice: selectedVoice, language });
      greetingPendingRef.current = false;
      onSendMessage("", greeting.reply, greeting.audio_base64);

      if (greeting.audio_base64 && !isAgentVoiceMutedRef.current) {
        playAudio(greeting.audio_base64, messages.length);
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
  const handleSendText = async () => {
    const text = inputText.trim();
    if (!text || isTextLoading) return;

    // Auto-connect if disconnected
    if (!isConnectedRef.current) {
      setIsConnected(true);
    }

    setInputText("");
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
      {/* 1. Voice Agent Header: Status & Connection Pill */}
      <div className="w-full shrink-0 flex flex-col items-center justify-center pt-0.5 pb-1">
        <div className="flex items-center gap-2 mb-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-xs font-medium tracking-wide transition-all duration-300">
          {/* Status Indicator Dot */}
          <span
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              state === "disconnected"
                ? "bg-[#ff2222] shadow-[0_0_8px_#ff2222]"
                : state === "connecting"
                ? "bg-[#1eff00] shadow-[0_0_8px_#1eff00] animate-pulse"
                : state === "ready"
                ? "bg-[#10b981] shadow-[0_0_8px_#10b981]"
                : state === "listening"
                ? "bg-[#ff5500] shadow-[0_0_8px_#ff5500] animate-pulse"
                : state === "thinking"
                ? "bg-[#ff00e1] shadow-[0_0_8px_#ff00e1] animate-pulse"
                : "bg-[#0026ff] shadow-[0_0_8px_#0026ff] animate-pulse"
            }`}
          />

          {/* Status Text */}
          <span className="text-white/85 select-none text-[11px] sm:text-xs">
            {state === "disconnected"
              ? (language === "ar" ? "╪║┘è╪▒ ┘à╪¬╪╡┘ä" : "Disconnected")
              : state === "connecting"
              ? (language === "ar" ? "╪¼╪º╪▒┘ì ╪º┘ä╪º╪¬╪╡╪º┘ä..." : "Connecting...")
              : state === "ready"
              ? (language === "ar" ? "╪¼╪º┘ç╪▓ ┘ä┘ä┘à╪¡╪º╪»╪½╪⌐" : "Agent Ready")
              : state === "listening"
              ? (language === "ar" ? "╪¼╪º╪▒┘ì ╪º┘ä╪º╪│╪¬┘à╪º╪╣..." : "Listening...")
              : state === "thinking"
              ? (language === "ar" ? "╪¼╪º╪▒┘ì ╪º┘ä╪¬┘ü┘â┘è╪▒..." : "Thinking...")
              : (language === "ar" ? "┘è╪¬╪¡╪»╪½ ╪º┘ä╪ó┘å..." : "Speaking...")}
          </span>

          <span className="w-px h-3.5 bg-white/20 mx-0.5" />

          {/* Connect / Disconnect Action Button */}
          {!isConnected ? (
            <button
              onClick={() => void connectAgent()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer outline-none"
              title={language === "ar" ? "╪º╪¬╪╡╪º┘ä ╪¿╪º┘ä┘ê┘â┘è┘ä" : "Connect Agent"}
            >
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>{language === "ar" ? "╪º╪¬╪╡╪º┘ä" : "Connect"}</span>
            </button>
          ) : (
            <button
              onClick={() => void disconnectAgent()}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-red-400/90 hover:text-red-300 transition-colors cursor-pointer outline-none"
              title={language === "ar" ? "┘é╪╖╪╣ ╪º┘ä╪º╪¬╪╡╪º┘ä" : "Disconnect"}
            >
              <Power className="w-3 h-3 text-red-400/90" />
              <span>{language === "ar" ? "┘é╪╖╪╣ ╪º┘ä╪º╪¬╪╡╪º┘ä" : "Disconnect"}</span>
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

      {/* 2. Messages Stream Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-3 pr-1 space-y-3">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const isAudioPlaying = playingAudioIndex === index;

          return (
            <div
              key={index}
              className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-[#2e8b57] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Volume2 className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              <div
                className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-[#2e8b57] text-white font-normal rounded-xl rounded-tr-none"
                    : "bg-black/35 text-white font-normal rounded-xl rounded-tl-none"
                }`}
                dir="auto"
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Audio Replay Button for Bot Messages */}
                {!isUser && msg.audioBase64 && (
                  <div className="mt-2.5 pt-1 flex items-center justify-between">
                    <button
                      onClick={() => playAudio(msg.audioBase64!, index)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2e8b57] hover:bg-[#257347] text-white font-normal text-xs transition-colors cursor-pointer"
                    >
                      {isAudioPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current text-white" />
                          <span>{t.stopAudio}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-white" />
                          <span>{t.replayAudio}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full bg-[#2e8b57] text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          );
        })}

        {liveTranscript && (
          <div className="flex justify-end" aria-live="polite">
            <div className="max-w-[85%] rounded-xl bg-[#2e8b57]/30 px-4 py-3 text-sm leading-relaxed text-white">
              <p className="whitespace-pre-wrap" dir="auto">{liveTranscript}</p>
            </div>
          </div>
        )}

        {isTextLoading && (
          <div className="flex gap-2.5 justify-start">
            <div className="w-7 h-7 rounded-full bg-[#2e8b57] text-white flex items-center justify-center shrink-0">
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
              ? (language === "ar" ? "╪º┘ä┘à┘è┘â╪▒┘ê┘ü┘ê┘å ┘é┘è╪» ╪º┘ä╪º╪│╪¬┘à╪º╪╣ (╪º┘å┘é╪▒ ┘ä┘ä┘â╪¬┘à)" : "Microphone Active (Click to mute)")
              : (language === "ar" ? "╪º┘ä┘à┘è┘â╪▒┘ê┘ü┘ê┘å ┘à┘â╪¬┘ê┘à (╪º┘å┘é╪▒ ┘ä┘ä╪¬╪¡╪»╪½)" : "Microphone Muted (Click to talk)")
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
              ? (language === "ar" ? "╪╡┘ê╪¬ ╪º┘ä┘ê┘â┘è┘ä ┘à┘â╪¬┘ê┘à (┘ê╪╢╪╣ ╪º┘ä┘å╪╡ ╪º┘ä╪╡╪º┘à╪¬)" : "Agent Voice: MUTED (Silent text mode)")
              : (language === "ar" ? "╪╡┘ê╪¬ ╪º┘ä┘ê┘â┘è┘ä ┘à┘ü╪╣┘æ┘ä (╪º┘å┘é╪▒ ┘ä┘ä┘â╪¬┘à)" : "Agent Voice: ON (Click to mute)")
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
          className="bg-[#2e8b57] hover:bg-[#257347] disabled:opacity-40 text-white p-2.5 rounded-lg cursor-pointer transition-colors shrink-0 outline-none focus:outline-none focus:ring-0"
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
