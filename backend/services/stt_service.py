import re
import math
import struct
import logging
from typing import Optional, Tuple
import requests

from backend.config import (
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_WHISPER_MODEL,
    GROQ_API_KEY,
)

logger = logging.getLogger("stt_service")

# Clean Whisper hallucinations triggered by low-level ambient noise / silence
HALLUCINATION_REGEX = re.compile(
    r"(\[.*?\]|\(.*?\)|اشترك\s*(في|بال)*\s*القناة|شكرا\s*(لكم)*\s*(على)*\s*المشاهدة|ترجمة|سندريلا|يوتيوب|MBC)",
    re.IGNORECASE
)

def get_audio_rms(audio_bytes: bytes) -> float:
    """Calculates peak RMS energy across windowed 16-bit PCM WAV chunks to detect actual speech presence."""
    if len(audio_bytes) < 44 or not audio_bytes.startswith(b"RIFF"):
        return 1.0  # Non-WAV or raw stream, bypass check
    try:
        pcm_bytes = audio_bytes[44:]
        sample_count = len(pcm_bytes) // 2
        if sample_count == 0:
            return 0.0
        
        # Scan across the entire audio in 100ms windows (1600 samples at 16kHz)
        # to ensure speech isn't missed even if preceded by 500ms of leading silence
        chunk_size = 1600
        max_rms = 0.0
        for i in range(0, sample_count, chunk_size):
            samples_to_read = min(chunk_size, sample_count - i)
            if samples_to_read < 100:
                continue
            samples = struct.unpack_from(f"<{samples_to_read}h", pcm_bytes, i * 2)
            sum_sq = sum(s * s for s in samples)
            rms = math.sqrt(sum_sq / samples_to_read) / 32768.0
            if rms > max_rms:
                max_rms = rms
        return max_rms
    except Exception as e:
        logger.debug(f"RMS calculation bypassed: {e}")
        return 1.0

class MultiWhisperSTTService:
    """
    High-Performance Whisper STT:
    1. Primary: Groq Cloud Whisper Large-v3-Turbo (~200ms ultra-low latency, world's fastest Whisper).
    2. Fallback: Cloudflare Workers AI Whisper (@cf/openai/whisper).
    - Automatic multi-language detection (Arabic & English).
    - Robust hallucination stripping and silence filtering.
    """
    def __init__(self):
        self.groq_api_key = GROQ_API_KEY
        self.cf_api_token = CLOUDFLARE_API_TOKEN
        self.cf_account_id = CLOUDFLARE_ACCOUNT_ID
        self.cf_model = CLOUDFLARE_WHISPER_MODEL
        self.cf_url = f"https://api.cloudflare.com/client/v4/accounts/{self.cf_account_id}/ai/run/{self.cf_model}"

    def _transcribe_groq(self, audio_bytes: bytes) -> Optional[str]:
        if not self.groq_api_key:
            return None
        try:
            files = {"file": ("speech.wav", audio_bytes, "audio/wav")}
            data = {"model": "whisper-large-v3-turbo", "response_format": "json"}
            headers = {"Authorization": f"Bearer {self.groq_api_key}"}
            resp = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=12
            )
            if resp.status_code == 200:
                text = resp.json().get("text", "").strip()
                logger.info("Transcribed successfully via Groq Whisper Large-v3-Turbo")
                return text
            else:
                logger.warning(f"Groq Whisper returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Groq Whisper error: {e}")
        return None

    def _transcribe_cloudflare(self, audio_bytes: bytes) -> Optional[str]:
        if not self.cf_api_token or not self.cf_account_id:
            return None
        try:
            headers = {"Authorization": f"Bearer {self.cf_api_token}"}
            resp = requests.post(
                self.cf_url,
                headers=headers,
                json={"audio": list(audio_bytes)},
                timeout=25
            )
            if resp.status_code == 200:
                res_data = resp.json()
                text = res_data.get("result", {}).get("text", "").strip()
                logger.info("Transcribed successfully via Cloudflare Workers AI Whisper")
                return text
            else:
                logger.error(f"Cloudflare Whisper returned {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Cloudflare Whisper error: {e}")
        return None

    def transcribe(self, audio_bytes: bytes, language: Optional[str] = None) -> Tuple[str, str]:
        if not audio_bytes or len(audio_bytes) < 44:
            return "", "ar"

        peak_rms = get_audio_rms(audio_bytes)
        if peak_rms < 0.003:
            logger.info(f"Audio discarded: peak RMS energy ({peak_rms:.5f}) below speech threshold.")
            return "", "ar"

        raw_text = None

        # 1. Try Groq Whisper Large-v3-Turbo first for sub-second speed
        if self.groq_api_key:
            raw_text = self._transcribe_groq(audio_bytes)

        # 2. Fallback to Cloudflare Workers AI Whisper if Groq failed or not configured
        if not raw_text:
            raw_text = self._transcribe_cloudflare(audio_bytes)

        if not raw_text:
            return "", "ar"

        # Clean hallucinations and noise
        cleaned_text = HALLUCINATION_REGEX.sub("", raw_text).strip()
        if re.fullmatch(r"[\s\.\,\?\!\،\؟\-_…]+", cleaned_text):
            cleaned_text = ""

        # Language heuristic: detect Arabic vs English based on character set
        has_arabic = bool(re.search(r"[\u0600-\u06FF]", cleaned_text))
        detected_lang = "ar" if has_arabic else "en"

        logger.info(f"Whisper STT output [lang={detected_lang}]: '{cleaned_text}'")
        return cleaned_text, detected_lang

stt_service = MultiWhisperSTTService()
