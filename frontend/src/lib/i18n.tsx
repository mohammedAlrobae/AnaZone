"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore, ReactNode } from "react";

export type Language = "en" | "ar";
export type Direction = "ltr" | "rtl";

export interface Translations {
  // Navbar
  brand: string;
  about: string;
  contact: string;
  aboutModalTitle: string;
  aboutModalBody: string;
  close: string;

  // Hero Section
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  heroJumpHint: string;

  // Voice Interaction Section
  sectionTitle: string;
  sectionSubtitle: string;

  // Voice Selector
  selectVoiceTitle: string;
  selectVoiceSubtitle: string;
  activeBadge: string;
  clickToSelect: string;
  playingSample: string;
  personaReady: string;
  clickToAudition: string;

  // Persona Names & Roles
  yasminName: string;
  yasminRole: string;
  yasminDesc: string;

  ahmedName: string;
  ahmedRole: string;
  ahmedDesc: string;

  tareqName: string;
  tareqRole: string;
  tareqDesc: string;

  // Voice Agent Area
  statusIdle: string;
  statusListening: string;
  statusProcessing: string;
  statusSpeaking: string;
  statusError: string;
  startVoiceChat: string;
  muteMicrophone: string;
  unmuteMicrophone: string;
  microphoneMuted: string;
  liveTranscriptError: string;
  voiceActive: string;
  voiceMuted: string;
  voiceMutedTooltip: string;
  voiceActiveTooltip: string;
  clickToTalk: string;
  startConversation: string;
  endConversation: string;
  sendVoice: string;
  thinking: string;
  stopVoice: string;
  dspNoiseActive: string;
  micInputInfo: string;
  outputVoiceLabel: string;
  noSpeechError: string;

  // Chat Box
  chatTitle: string;
  chatMutedMode: string;
  chatVoiceMode: string;
  clearBtn: string;
  noMessagesTitle: string;
  noMessagesSubtitle: string;
  inputPlaceholder: string;
  replayAudio: string;
  stopAudio: string;
  synthesizingWith: string;
  chatErrorNotice: string;
  suggestions: string[];
  // Geographic Exploration & World Map
  mapTitle: string;
  mapSubtitle: string;
  mapCoordsHud: string;
  mapClickHint: string;
  mapQuickJump: string;
  activeLocationLabel: string;
  askAboutLocation: string;
  deepQASuggestions: string[];
  soundwaveTitle: string;

  // Footer
  footerBrand: string;
}

const translations: Record<Language, Translations> = {
  en: {
    brand: "AnaZone",
    about: "About",
    contact: "Contact",
    aboutModalTitle: "About AnaZone",
    aboutModalBody: "AnaZone is a next-generation planetary intelligence platform that bridges real-time voice conversation with photorealistic 3D Earth exploration.\n\nBuilt around natural human dialogue, our intelligent companion listens with sub-second Whisper recognition, reasons with high-capacity neural models, and speaks with authentic, emotionally nuanced voices in both Egyptian Arabic and English.\n\nTravel across continents or select any city, historical landmark, or natural wonder on the 3D globe to receive an immediate, immersive spoken briefing—enriched with live atmospheric weather data, real-time regional news, and rich cultural context.\n\nPowered entirely by distributed cloud neural pipelines, AnaZone delivers instant speech recognition, low-latency WebRTC streaming, and grounded planetary awareness in a unified, fluid experience.",
    close: "Close",

    heroTitle: "Voice Companion & World Explorer",
    heroSubtitle: "Natural voice conversations and interactive world exploration.",
    heroCta: "Start Voice Chat",
    heroJumpHint: "Click the arrow to jump down to the voice agent section",

    sectionTitle: "Voice Studio",
    sectionSubtitle: "Choose a persona and speak naturally.",

    selectVoiceTitle: "Voice Personas",
    selectVoiceSubtitle: "Select a persona: Yasmin, Ahmed, or Tareq",
    activeBadge: "Active",
    clickToSelect: "Click to select",
    playingSample: "Playing voice sample...",
    personaReady: "Persona Ready",
    clickToAudition: "Click to Select & Audition",

    yasminName: "Yasmin",
    yasminRole: "Female • Professional & Calm",
    yasminDesc: "Clear, composed, and trustworthy tone, ideal for advisory, business, and formal support.",

    ahmedName: "Ahmed",
    ahmedRole: "Male • Customer Service & Friendly",
    ahmedDesc: "Warm, natural, and friendly tone for everyday conversational assistance and customer service.",

    tareqName: "Tareq",
    tareqRole: "Male • Promo & Energetic",
    tareqDesc: "Confident, dynamic, and impactful tone with energetic, compelling delivery.",

    statusIdle: "Start conversation",
    statusListening: "Listening...",
    statusProcessing: "Thinking...",
    statusSpeaking: "Speaking...",
    statusError: "Connection notice",
    startVoiceChat: "Start conversation",
    muteMicrophone: "Mute microphone",
    unmuteMicrophone: "Unmute microphone",
    microphoneMuted: "Microphone muted",
    voiceActive: "Voice Active",
    voiceMuted: "Microphone muted",
    voiceMutedTooltip: "Microphone muted",
    voiceActiveTooltip: "Voice playback enabled",
    clickToTalk: "Click to Talk",
    startConversation: "Start conversation",
    endConversation: "End conversation",
    sendVoice: "Send Voice",
    thinking: "Thinking...",
    stopVoice: "Stop Voice",
    dspNoiseActive: "DSP Noise Filter Active",
    micInputInfo: "Tap to talk",
    outputVoiceLabel: "Voice",
    noSpeechError: "No speech detected. Please speak closer to the microphone.",
    liveTranscriptError: "Live transcription is temporarily unavailable.",

    chatTitle: "Interactive Conversation",
    chatMutedMode: "Muted mode (text only)",
    chatVoiceMode: "Voice replies enabled",
    clearBtn: "Clear",
    noMessagesTitle: "No messages yet",
    noMessagesSubtitle: "Type a message below or speak through the microphone.",
    inputPlaceholder: "Type a message...",
    replayAudio: "Replay Voice",
    stopAudio: "Stop Voice",
    synthesizingWith: "Synthesizing with",
    chatErrorNotice: "Could not reach the server. Please check connection.",
    suggestions: [
      "What are the most famous landmarks you recommend?",
      "Tell me about the history of the Pyramids",
      "When is the best season to travel around the world?",
    ],

    // Geographic Exploration & World Map
    mapTitle: "Interactive World Exploration Map",
    mapSubtitle: "Hover over any place to view live coordinates, click to listen to voice briefing & explore deeply",
    mapCoordsHud: "Live Coordinates",
    mapClickHint: "Click anywhere on the globe to explore",
    mapQuickJump: "Popular Destinations",
    activeLocationLabel: "Currently Exploring",
    askAboutLocation: "Ask anything about this place, culture, history, or cuisine...",
    deepQASuggestions: [
      "What are the most famous landmarks here?",
      "Tell me about the history and culture",
      "What is the traditional cuisine like?",
      "What is the best season to visit?",
    ],
    soundwaveTitle: "Live Voice Waveform & Microphone",

    footerBrand: "AnaZone",
  },

  ar: {
    brand: "AnaZone",
    about: "عن المنصة",
    contact: "تواصل معنا",
    aboutModalTitle: "عن أنا زون (AnaZone)",
    aboutModalBody: "أنا زون (AnaZone) هي منصة استكشافية ذكية من الجيل القادم، تجمع بسلاسة بين المحادثة الصوتية الحية واستكشاف كوكب الأرض ثلاثي الأبعاد بدقة فائقة.\n\nصُمم الرفيق الذكي ليحاكي الحوار البشري الطبيعي؛ حيث يستمع إليك في أجزاء من الثانية عبر نموذج Whisper فائق السرعة، ويفكر عبر نماذج ذكاء اصطناعي عملاقة، ويتحدث بنبرات صوتية طبيعية وجذابة بالعامية المصرية الأصيلة واللغة الإنجليزية مع الحفاظ التام على هوية الصوت.\n\nحلّق عبر القارات واختر أي مدينة أو معلم تاريخي على مجسم الأرض لتستمع فوراً إلى إحاطة صوتية تفاعلية غنية بالمعلومات الثقافية والتاريخية، مدعومة بتحديثات الطقس الحية وأحدث الأخبار الإقليمية اللحظية.\n\nتعتمد المنصة بالكامل على بنية سحابية متقدمة تدمج النماذج العصبية فائقة السرعة مع تقنيات البث الصوتي الفوري عبر WebRTC لتقديم تجربة استكشاف عالمية استثنائية.",
    close: "إغلاق",

    heroTitle: "رفيقك الصوتي واستكشاف العالم",
    heroSubtitle: "محادثات صوتية طبيعية واستكشاف تفاعلي لمعالم العالم.",
    heroCta: "ابدأ المحادثة الصوتية",
    heroJumpHint: "اضغط على السهم للانتقال مباشرة إلى قسم التحدث",

    sectionTitle: "استوديو الصوت",
    sectionSubtitle: "اختر الشخصية المناسبة وتحدث بكل عفوية.",

    selectVoiceTitle: "شخصيات الصوت",
    selectVoiceSubtitle: "اختر الشخصية المناسبة: ياسمين، أحمد، أو طارق",
    activeBadge: "مفعّل",
    clickToSelect: "اضغط للاختيار",
    playingSample: "جارٍ تشغيل عينة الصوت...",
    personaReady: "الشخصية جاهزة",
    clickToAudition: "اضغط للاختيار والاستماع",

    yasminName: "ياسمين",
    yasminRole: "أنثى • هادئ واحترافي",
    yasminDesc: "صوت متزن، واثق ومريح، مناسب للاستشارات والحوار الهادئ.",

    ahmedName: "أحمد",
    ahmedRole: "ذكر • ودود وخدمة عملاء",
    ahmedDesc: "صوت دافئ وودود وطبيعي للمحادثات اليومية والتعاملات المباشرة.",

    tareqName: "طارق",
    tareqRole: "ذكر • حماسي وتفاعلي",
    tareqDesc: "صوت قوي، حماسي وواثق يتميز بالإقناع وسرعة التفاعل.",

    statusIdle: "ابدأ المحادثة",
    statusListening: "جارٍ الاستماع...",
    statusProcessing: "جارٍ التفكير...",
    statusSpeaking: "يتحدث الآن...",
    statusError: "تنبيه في الاتصال",
    startVoiceChat: "ابدأ المحادثة الصوتية",
    muteMicrophone: "كتم الميكروفون",
    unmuteMicrophone: "تشغيل الميكروفون",
    microphoneMuted: "الميكروفون مكتوم",
    voiceActive: "الصوت مفعّل",
    voiceMuted: "الميكروفون مكتوم",
    voiceMutedTooltip: "الميكروفون مكتوم",
    voiceActiveTooltip: "تشغيل الصوت مفعّل",
    clickToTalk: "اضغط للتحدث",
    startConversation: "ابدأ المحادثة",
    endConversation: "إنهاء المحادثة",
    sendVoice: "إرسال الصوت",
    thinking: "جارٍ التفكير...",
    stopVoice: "إيقاف الصوت",
    dspNoiseActive: "عازل الضوضاء الذكي مفعّل",
    micInputInfo: "اضغط لبدء الحديث",
    outputVoiceLabel: "الصوت",
    noSpeechError: "لم يتم التقاط صوت واضح. يرجى التحدث بالقرب من الميكروفون.",
    liveTranscriptError: "التفريغ المباشر غير متاح مؤقتًا.",

    chatTitle: "المحادثة التفاعلية",
    chatMutedMode: "الوضع الصامت (نصوص فقط)",
    chatVoiceMode: "الردود الصوتية مفعّلة",
    clearBtn: "مسح السجل",
    noMessagesTitle: "لا توجد رسائل بعد",
    noMessagesSubtitle: "اكتب رسالة أو تحدث مباشرة عبر الميكروفون.",
    inputPlaceholder: "اكتب رسالتك...",
    replayAudio: "إعادة الصوت",
    stopAudio: "إيقاف الصوت",
    synthesizingWith: "جارٍ الرد بصوت",
    chatErrorNotice: "تعذر الاتصال بالسيرفر. يرجى التأكد من تشغيل الباك إند.",
    suggestions: [
      "إيه أشهر المعالم اللي تنصحني أزورها؟",
      "احكيلي عن تاريخ الأهرامات وبنائها",
      "إيه أحسن وقت للسفر حول العالم؟",
    ],

    // Geographic Exploration & World Map
    mapTitle: "خريطة استكشاف العالم التفاعلية",
    mapSubtitle: "حرّك المؤشر لمشاهدة الإحداثيات الحية، وانقر على أي مكان للاستماع للشرح الصوتي والبدء في الاستكشاف",
    mapCoordsHud: "الإحداثيات الحية",
    mapClickHint: "انقر على أي نقطة على الخريطة لبدء التحدث والاستكشاف",
    mapQuickJump: "وجهات استكشاف شهيرة",
    activeLocationLabel: "الموقع المستكشَف حالياً",
    askAboutLocation: "اسأل عن تاريخ هذا المكان، معالمه، ثقافته، أو أكلاته الشعبية...",
    deepQASuggestions: [
      "إيه أشهر المعالم السياحية هنا؟",
      "احكيلي عن تاريخ البلد وثقافتها",
      "إيه أشهر الأكلات الشعبية عندهم؟",
      "إيه أحسن وقت أزور فيه المكان ده؟",
    ],
    soundwaveTitle: "الموجات الصوتية الحية والميكروفون",

    footerBrand: "AnaZone",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  dir: Direction;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "voice_agent_lang";
const LANGUAGE_CHANGE_EVENT = "voice-agent-language-change";
let languageOverride: Language | null = null;

function getLanguageSnapshot(): Language {
  if (languageOverride) return languageOverride;
  if (typeof window === "undefined") return "en";

  try {
    return window.localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

function getServerLanguageSnapshot(): Language {
  return "en";
}

function subscribeToLanguageChanges(onChange: () => void) {
  if (typeof window === "undefined") return () => { };

  const handleStorageChange = () => {
    languageOverride = null;
    onChange();
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(
    subscribeToLanguageChanges,
    getLanguageSnapshot,
    getServerLanguageSnapshot
  );

  const setLanguage = (lang: Language) => {
    languageOverride = lang;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, lang);
      }
    } catch {
      // ignore localStorage quota errors
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
    }
  };

  const toggleLanguage = () => {
    const nextLang: Language = language === "en" ? "ar" : "en";
    setLanguage(nextLang);
  };

  // Always keep page layout LTR as requested - only text content changes
  const dir: Direction = "ltr";

  // Sync html attributes (keep dir strictly ltr)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = "ltr";
    }
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        dir,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return context;
}
