const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface VoiceProfile {
  id: string;
  speaker_id: string;
  name_ar: string;
  gender: string;
  role: string;
  description: string;
  sample_url: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  audioBase64?: string | null;
  timestamp?: string;
}

export interface PipelineResponse {
  user_text: string;
  bot_text: string;
  audio_base64?: string | null;
  voice: string;
  is_muted?: boolean;
  language?: string;
}

export interface ChatApiResponse {
  reply: string;
  audio_base64?: string | null;
  voice: string;
  is_muted?: boolean;
}

export async function sendGreeting(params: {
  voice: string;
  language: string;
}): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat/greeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}

export async function fetchVoices(): Promise<{ voices: VoiceProfile[]; default: string }> {
  const res = await fetch(`${API_BASE_URL}/api/voice/voices`);
  if (!res.ok) {
    throw new Error(`Failed to fetch voices (${res.status})`);
  }
  return res.json();
}

export function getVoiceSampleUrl(voiceId: string, language: string = "ar"): string {
  return `${API_BASE_URL}/api/voice/sample/${voiceId}?lang=${language}`;
}

export interface ExploreLocationResponse {
  location_name: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  intro_text: string;
  audio_base64?: string | null;
  voice: string;
  is_muted?: boolean;
}

export async function sendVoicePipeline(params: {
  audioBase64: string;
  voice: string;
  history: { role: string; content: string }[];
  isMuted: boolean;
  locationContext?: string;
}): Promise<PipelineResponse> {
  const res = await fetch(`${API_BASE_URL}/api/voice/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_base64: params.audioBase64,
      voice: params.voice,
      history: params.history,
      is_muted: params.isMuted,
      location_context: params.locationContext,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}

export async function transcribeVoiceChunk(audioBase64: string): Promise<{
  text: string;
  language: string;
}> {
  const formData = new FormData();
  formData.set("audio_base64", audioBase64);

  const res = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}

export async function sendChatMessage(params: {
  message: string;
  voice: string;
  history: { role: string; content: string }[];
  isMuted: boolean;
  locationContext?: string;
}): Promise<ChatApiResponse> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: params.message,
      voice: params.voice,
      history: params.history,
      is_muted: params.isMuted,
      location_context: params.locationContext,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}

export async function exploreLocation(params: {
  locationName: string;
  country?: string;
  city?: string;
  lat: number;
  lng: number;
  voice: string;
  isMuted: boolean;
  language?: string;
}): Promise<ExploreLocationResponse> {
  const res = await fetch(`${API_BASE_URL}/api/voice/explore-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location_name: params.locationName,
      country: params.country || "",
      city: params.city || "",
      lat: params.lat,
      lng: params.lng,
      voice: params.voice,
      is_muted: params.isMuted,
      language: params.language || "ar",
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(errorData.detail || `Server error (${res.status})`);
  }

  return res.json();
}
