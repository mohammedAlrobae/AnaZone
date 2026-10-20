"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Volume2,
  Square,
  Loader2,
  Send,
  Bot,
  User,
  Mic,
  MicOff,
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
import DynamicVoiceWave from "./DynamicVoiceWave";

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

type AgentState = "idle" | "listening" | "processing" | "speaking" | "error";

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
  const [state, setState] = useState<AgentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [inputText, setInputText] = useState("");
  const [isTextLoading, setIsTextLoading] = useState(false);
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);

  const recorderRef = useRef<WavRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const handsFreeRef = useRef(false);
  const micMutedRef = useRef(false);
  const startingConversationRef = useRef(false);
  const transcriptionSessionRef = useRef(0);
  const partialTranscriptionBusyRef = useRef(false);
  const pendingPartialAudioRef = useRef<{ audioBase64: string; session: number } | null>(null);
  const liveTranscriptRef = useRef("");
  const greetingPendingRef = useRef(false);
  const processingRef = useRef(false);
  const stopListeningRef = useRef<() => void>(() => { });
  const resumeListeningRef = useRef<() => void>(() => { });
  const { t, language } = useI18n();

  const playingAudioIndexRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stop().catch(() => { });
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTextLoading, state]);

  const setAgentState = React.useCallback((newState: AgentState) => {
    setState(newState);
    if (onAgentSpeakingChange) {
      onAgentSpeakingChange(newState === "speaking");
    }
  }, [onAgentSpeakingChange]);

  const updateLiveTranscription = React.useCallback(async (
    audioBase64: string,
    session: number
  ) => {
    if (
      session !== transcriptionSessionRef.current ||
      !handsFreeRef.current ||
      micMutedRef.current ||
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
            !micMutedRef.current
          ) {
            const merged = mergeTranscript(liveTranscriptRef.current, result.text.trim());
            liveTranscriptRef.current = merged;
            setLiveTranscript(merged);
          }
        } catch (error: unknown) {
          console.error("Live Whisper transcription failed:", error);
          if (request.session === transcriptionSessionRef.current) {
            setErrorMessage(t.liveTranscriptError);
          }
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
  }, [t.liveTranscriptError]);

  const playAudio = React.useCallback((base64Data: string, messageIndex: number) => {
    if (playingAudioIndexRef.current === messageIndex && currentAudioRef.current) {
      currentAudioRef.current.pause();
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      setAgentState("idle");
      if (handsFreeRef.current) resumeListeningRef.current();
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    setAgentState("speaking");
    playingAudioIndexRef.current = messageIndex;
    setPlayingAudioIndex(messageIndex);

    const audioSrc = base64Data.startsWith("data:")
      ? base64Data
      : `data:audio/wav;base64,${base64Data}`;

    const audio = new Audio(audioSrc);
    currentAudioRef.current = audio;

    audio.onended = () => {
      setAgentState("idle");
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      currentAudioRef.current = null;
      if (handsFreeRef.current) resumeListeningRef.current();
    };

    audio.onerror = () => {
      setAgentState("idle");
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      currentAudioRef.current = null;
      if (handsFreeRef.current) resumeListeningRef.current();
    };

    audio.play().catch((err) => {
      console.warn("Autoplay notice:", err);
      setAgentState("idle");
      playingAudioIndexRef.current = null;
      setPlayingAudioIndex(null);
      if (handsFreeRef.current) resumeListeningRef.current();
    });
  }, [setAgentState]);

  useEffect(() => {
    if (agentSpeakingAudio) {
      playAudio(agentSpeakingAudio, -1);
    }
  }, [agentSpeakingAudio, playAudio]);

  const stopAudio = React.useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    playingAudioIndexRef.current = null;
    setAgentState("idle");
    setPlayingAudioIndex(null);
  }, [setAgentState]);

  const startListening = React.useCallback(async () => {
    if (recorderRef.current) return true;
    if (micMutedRef.current) return false;
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
        if (handsFreeRef.current && !greetingPendingRef.current) {
          window.setTimeout(() => stopListeningRef.current(), 0);
        }
      }, (audioBase64) => {
        void updateLiveTranscription(audioBase64, transcriptionSession);
      });
      return true;
    } catch (err: unknown) {
      console.error("Microphone error:", err);
      recorderRef.current = null;
      setAgentState("error");
      setErrorMessage("Could not access microphone.");
      return false;
    }
  }, [setAgentState, stopAudio, updateLiveTranscription]);

  const stopListeningAndProcess = React.useCallback(async () => {
    if (!recorderRef.current || processingRef.current) return;
    processingRef.current = true;

    try {
      setAgentState("processing");
      setVolumeLevel(0);
      transcriptionSessionRef.current += 1;
      pendingPartialAudioRef.current = null;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      const { base64, hasSpeech } = await recorder.stop();

      if (!hasSpeech) {
        liveTranscriptRef.current = "";
        setLiveTranscript("");
        if (handsFreeRef.current) {
          resumeListeningRef.current();
        } else {
          setAgentState("idle");
          setErrorMessage(t.noSpeechError);
          setTimeout(() => setErrorMessage(null), 3000);
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
        isMuted: false,
        locationContext: locationContextStr,
      });

      if (!response.user_text && !response.bot_text) {
        if (handsFreeRef.current) resumeListeningRef.current();
        else setAgentState("idle");
        return;
      }

      onSendMessage(response.user_text, response.bot_text, response.audio_base64);
      liveTranscriptRef.current = "";
      setLiveTranscript("");

      if (response.audio_base64) {
        playAudio(response.audio_base64, messages.length + 1);
      } else if (handsFreeRef.current) {
        resumeListeningRef.current();
      } else {
        setAgentState("idle");
      }
    } catch (err: unknown) {
      console.error("Pipeline error:", err);
      handsFreeRef.current = false;
      setIsHandsFree(false);
      setAgentState("error");
      setErrorMessage((err as Error)?.message || "Error processing voice request");
    } finally {
      processingRef.current = false;
    }
  }, [activeLocation, messages, onSendMessage, playAudio, selectedVoice, setAgentState, t.noSpeechError]);

  useEffect(() => {
    stopListeningRef.current = () => {
      void stopListeningAndProcess();
    };
    resumeListeningRef.current = () => {
      if (!handsFreeRef.current || micMutedRef.current || recorderRef.current) return;
      window.setTimeout(() => {
        if (handsFreeRef.current && !micMutedRef.current && !recorderRef.current) {
          void startListening();
        }
      }, 250);
    };
  }, [startListening, stopListeningAndProcess]);

  const startConversation = async () => {
    if (startingConversationRef.current) return;
    startingConversationRef.current = true;
    handsFreeRef.current = true;
    micMutedRef.current = false;
    setIsMicMuted(false);
    greetingPendingRef.current = true;
    setIsHandsFree(true);
    const microphoneReady = await startListening();
    if (!microphoneReady) {
      handsFreeRef.current = false;
      greetingPendingRef.current = false;
      setIsHandsFree(false);
      startingConversationRef.current = false;
      return;
    }

    try {
      setAgentState("processing");
      const greeting = await sendGreeting({ voice: selectedVoice, language });
      if (recorderRef.current) {
        await recorderRef.current.stop();
        recorderRef.current = null;
      }
      greetingPendingRef.current = false;
      onSendMessage("", greeting.reply, greeting.audio_base64);
      if (greeting.audio_base64) {
        playAudio(greeting.audio_base64, messages.length);
      } else {
        resumeListeningRef.current();
      }
    } catch (err: unknown) {
      handsFreeRef.current = false;
      greetingPendingRef.current = false;
      setIsHandsFree(false);
      if (recorderRef.current) {
        await recorderRef.current.stop();
        recorderRef.current = null;
      }
      setAgentState("error");
      setErrorMessage((err as Error)?.message || "Could not start the conversation.");
    } finally {
      startingConversationRef.current = false;
    }
  };

  const handleVoiceControl = async () => {
    if (!handsFreeRef.current) {
      await startConversation();
      return;
    }

    const nextMutedState = !micMutedRef.current;
    micMutedRef.current = nextMutedState;
    setIsMicMuted(nextMutedState);

    if (nextMutedState) {
      transcriptionSessionRef.current += 1;
      pendingPartialAudioRef.current = null;
      liveTranscriptRef.current = "";
      setLiveTranscript("");
    }

    if (nextMutedState && recorderRef.current) {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      await recorder.stop();
      setVolumeLevel(0);
      if (state === "listening") setAgentState("idle");
      return;
    }

    if (!nextMutedState && !recorderRef.current && state !== "processing" && state !== "speaking") {
      await startListening();
    }
  };

  const handleSendText = async () => {
    const text = inputText.trim();
    if (!text || isTextLoading) return;

    setInputText("");
    setIsTextLoading(true);

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
        isMuted: false,
        locationContext: locationContextStr,
      });

      onSendMessage(text, res.reply, res.audio_base64);

      if (res.audio_base64) {
        playAudio(res.audio_base64, messages.length + 1);
      }
    } catch (err: unknown) {
      console.error("Chat error:", err);
      onSendMessage(text, t.chatErrorNotice, null);
    } finally {
      setIsTextLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-0 overflow-hidden bg-black/15 backdrop-blur-[3px] rounded-xl p-5 sm:p-6 flex flex-col relative text-white">
      {/* 1. Voice Agent Live Wave Header (Pure wave with real dynamic movement) */}
      <div className="w-full shrink-0">
        <DynamicVoiceWave
          state={state}
          volumeLevel={volumeLevel}
          isMicMuted={isMicMuted}
        />
      </div>

      {/* Error notice */}
      {errorMessage && (
        <div className="mt-2 px-3 py-1.5 rounded-lg bg-[#8b3a3a] text-white text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {/* 3. Messages Stream Area */}
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
                className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed ${isUser
                    ? "bg-[#2e8b57] text-white font-medium rounded-xl rounded-tr-none"
                    : "bg-black/35 text-white font-medium rounded-xl rounded-tl-none"
                  }`}
                dir="auto"
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Audio Replay Button for Bot Messages */}
                {!isUser && msg.audioBase64 && (
                  <div className="mt-2.5 pt-1 flex items-center justify-between">
                    <button
                      onClick={() => playAudio(msg.audioBase64!, index)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#2e8b57] hover:bg-[#257347] text-white font-bold text-xs transition-colors cursor-pointer"
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

      {/* 4. Bottom Text Input Bar with Mic Connection Button on the LEFT */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendText();
        }}
        dir="ltr"
        className="mt-3 p-1.5 rounded-xl bg-black/30 border border-white/20 flex items-center gap-2"
      >
        {/* Connection / Mic Icon Button placed strictly on the left */}
        <button
          type="button"
          onClick={() => void handleVoiceControl()}
          disabled={state === "processing"}
          aria-label={
            !isHandsFree
              ? t.startVoiceChat
              : isMicMuted
              ? t.unmuteMicrophone
              : t.muteMicrophone
          }
          title={
            !isHandsFree
              ? t.startVoiceChat
              : isMicMuted
              ? t.unmuteMicrophone
              : t.muteMicrophone
          }
          className={`p-2.5 rounded-lg transition-all duration-200 cursor-pointer shrink-0 flex items-center justify-center outline-none ${
            !isHandsFree
              ? "text-white/80 hover:text-white hover:bg-white/10"
              : isMicMuted
              ? "bg-[#78866B] text-white"
              : state === "listening"
              ? "bg-[#2E8B57] text-white shadow-[0_0_12px_rgba(46,139,87,0.7)] animate-pulse"
              : state === "speaking"
              ? "bg-[#2E8B57] text-white shadow-[0_0_10px_rgba(46,139,87,0.5)]"
              : "bg-[#78866B] text-white"
          }`}
        >
          {isMicMuted ? (
            <MicOff className="w-4 h-4 text-white" />
          ) : state === "processing" ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : state === "speaking" ? (
            <Volume2 className="w-4 h-4 text-white" />
          ) : (
            <Mic className="w-4 h-4 text-white" />
          )}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.inputPlaceholder}
          disabled={isTextLoading || state === "processing"}
          className="flex-1 bg-transparent text-white placeholder-white/60 px-3 py-2 text-sm font-medium outline-hidden"
          dir="auto"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isTextLoading || state === "processing"}
          className="bg-[#2e8b57] hover:bg-[#257347] disabled:opacity-40 text-white p-2.5 rounded-lg cursor-pointer transition-colors shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>
    </div>
  );
}
