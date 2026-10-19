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
)

logger = logging.getLogger("stt_service")

# Clean Whisper hallucinations triggered by low-level ambient noise / silence
HALLUCINATION_REGEX = re.compile(
    r"(\[.*?\]|\(.*?\)|اشترك\s*(في|بال)*\s*القناة|شكرا\s*(لكم)*\s*(على)*\s*المشاهدة|ترجمة|سندريلا|يوتيوب|MBC)",
    re.IGNORECASE
)

def get_audio_rms(audio_bytes: bytes) -> float:
    """Calculates RMS energy of 16-bit PCM WAV to verify actual vocal signal presence."""
    if len(audio_bytes) < 44 or not audio_bytes.startswith(b"RIFF"):
        return 1.0  # Non-WAV or raw stream, bypass check
    try:
        pcm_bytes = audio_bytes[44:]
        sample_count = len(pcm_bytes) // 2
        if sample_count == 0:
            return 0.0
        check_samples = min(sample_count, 8000)
        samples = struct.unpack_from(f"<{check_samples}h", pcm_bytes)
        sum_sq = sum(s * s for s in samples)
        rms = math.sqrt(sum_sq / check_samples) / 32768.0
        return rms
    except Exception as e:
        logger.debug(f"RMS calculation bypassed: {e}")
        return 1.0

class CloudflareWhisperSTTService:
    """
    Cloudflare Workers AI Speech-to-Text:
    - Runs 100% in Cloudflare's serverless cloud infrastructure.
    - Consumes 0 local CPU, 0 local GPU, 0 local VRAM on the user's machine.
    - Automatic multi-language detection (Arabic & English).
    """
    def __init__(self):
        self.api_token = CLOUDFLARE_API_TOKEN
        self.account_id = CLOUDFLARE_ACCOUNT_ID
        self.model = CLOUDFLARE_WHISPER_MODEL
        self.api_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model}"

    def transcribe(self, audio_bytes: bytes, language: Optional[str] = None) -> Tuple[str, str]:
        if not audio_bytes:
            raise ValueError("Audio buffer is empty")

        rms = get_audio_rms(audio_bytes)
        if rms < 0.003:
            logger.info(f"Audio discarded: RMS energy ({rms:.5f}) below speech threshold.")
            return "", "ar"

        if not self.api_token or not self.account_id:
            raise RuntimeError("Cloudflare API credentials not configured in .env")

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/octet-stream"
        }

        logger.info(f"Sending audio ({len(audio_bytes):,} bytes) to Cloudflare Workers AI ({self.model})...")
        response = requests.post(
            self.api_url,
            headers=headers,
            data=audio_bytes,
            timeout=25
        )

        if response.status_code != 200:
            error_text = response.text[:200]
            logger.error(f"Cloudflare Whisper API returned {response.status_code}: {error_text}")
            raise RuntimeError(f"Cloudflare STT error ({response.status_code}): {error_text}")

        res_data = response.json()
        raw_text = res_data.get("result", {}).get("text", "").strip()

        # Clean hallucinations
        cleaned_text = HALLUCINATION_REGEX.sub("", raw_text).strip()
        if re.fullmatch(r"[\s\.\,\?\!\،\؟\-_…]+", cleaned_text):
            cleaned_text = ""

        # Language heuristic: detect Arabic vs English based on character set
        has_arabic = bool(re.search(r"[\u0600-\u06FF]", cleaned_text))
        detected_lang = "ar" if has_arabic else "en"

        logger.info(f"Cloudflare Whisper [lang={detected_lang}]: '{cleaned_text}'")
        return cleaned_text, detected_lang

stt_service = CloudflareWhisperSTTService()
