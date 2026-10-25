import base64
from collections import Counter
import logging
import math
import re
import struct
from typing import Optional, Tuple

import requests

from backend.config import (
    CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_WHISPER_MODEL,
)

logger = logging.getLogger("stt_service")

HALLUCINATION_REGEX = re.compile(
    r"(\[.*?\]|\(.*?\)|اشترك\s*(في|بال)*\s*القناة|شكرا\s*(لكم)*\s*(على)*\s*المشاهدة|ترجمة|سندريلا|يوتيوب|MBC)",
    re.IGNORECASE,
)
ARABIC_LETTERS = (
    ("\u0600", "\u06ff"),
    ("\u0750", "\u077f"),
    ("\u08a0", "\u08ff"),
)


def get_audio_rms(audio_bytes: bytes) -> float:
    """Measure peak RMS in 100 ms windows for 16-bit PCM WAV input."""
    if len(audio_bytes) < 44 or not audio_bytes.startswith(b"RIFF"):
        return 1.0

    pcm_bytes = audio_bytes[44:]
    sample_count = len(pcm_bytes) // 2
    if sample_count == 0:
        return 0.0

    max_rms = 0.0
    for start in range(0, sample_count, 1600):
        count = min(1600, sample_count - start)
        if count < 100:
            continue
        samples = struct.unpack_from(f"<{count}h", pcm_bytes, start * 2)
        rms = math.sqrt(sum(sample * sample for sample in samples) / count) / 32768.0
        max_rms = max(max_rms, rms)
    return max_rms


def _is_arabic_letter(character: str) -> bool:
    return any(start <= character <= end for start, end in ARABIC_LETTERS)


def _is_latin_letter(character: str) -> bool:
    return (
        "A" <= character <= "Z"
        or "a" <= character <= "z"
        or "\u00c0" <= character <= "\u024f"
        or "\u1e00" <= character <= "\u1eff"
    )


def _is_repetitive_hallucination(text: str) -> bool:
    words = re.findall(r"[\w']+", text.lower())
    if len(words) < 9:
        return False
    trigrams = Counter(
        tuple(words[index:index + 3])
        for index in range(len(words) - 2)
    )
    return any(count >= 3 for count in trigrams.values())


class CloudflareWhisperSTTService:
    """Transcribe speech using only Cloudflare Workers AI Whisper Turbo."""

    def __init__(self) -> None:
        self.model = CLOUDFLARE_WHISPER_MODEL or "@cf/openai/whisper-large-v3-turbo"
        self.url = (
            f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}"
            f"/ai/run/{self.model}"
        )

    def _transcribe_cloudflare(self, audio_bytes: bytes) -> Tuple[str, Optional[str]]:
        if not CLOUDFLARE_API_TOKEN or not CLOUDFLARE_ACCOUNT_ID:
            raise RuntimeError("Cloudflare Whisper credentials are not configured")

        response = requests.post(
            self.url,
            headers={"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}"},
            json={
                "audio": base64.b64encode(audio_bytes).decode("ascii"),
                "task": "transcribe",
                "vad_filter": True,
                "beam_size": 5,
                "condition_on_previous_text": False,
                "no_speech_threshold": 0.6,
                "compression_ratio_threshold": 2.4,
            },
            timeout=30,
        )
        if not response.ok:
            raise RuntimeError(
                f"Cloudflare Whisper returned {response.status_code}: {response.text[:200]}"
            )

        payload = response.json()
        if not payload.get("success", True):
            raise RuntimeError(f"Cloudflare Whisper error: {payload.get('errors')}")

        result = payload.get("result") or payload
        detected_language = result.get("transcription_info", {}).get("language")
        text = result.get("text", "").strip()
        segments = result.get("segments") or []
        if segments:
            accepted_segments = []
            for segment in segments:
                if not isinstance(segment, dict):
                    continue
                no_speech_prob = segment.get("no_speech_prob")
                avg_logprob = segment.get("avg_logprob")
                compression_ratio = segment.get("compression_ratio")
                if isinstance(no_speech_prob, (int, float)) and no_speech_prob >= 0.75:
                    continue
                if isinstance(avg_logprob, (int, float)) and avg_logprob <= -1.4:
                    continue
                if isinstance(compression_ratio, (int, float)) and compression_ratio > 2.6:
                    continue
                accepted_segments.append(segment.get("text", ""))
            if accepted_segments:
                text = " ".join(accepted_segments).strip()

        return text, detected_language

    def transcribe(self, audio_bytes: bytes, language: Optional[str] = None) -> Tuple[str, str]:
        if not audio_bytes or len(audio_bytes) < 44:
            return "", "ar"
        if get_audio_rms(audio_bytes) < 0.001:
            logger.info("Discarded silent audio input")
            return "", "ar"

        raw_text, detected_language = self._transcribe_cloudflare(audio_bytes)
        cleaned_text = HALLUCINATION_REGEX.sub("", raw_text).strip()
        if not cleaned_text or re.fullmatch(r"[\s.,?!،؟\-_…]+", cleaned_text):
            return "", "ar"
        if _is_repetitive_hallucination(cleaned_text):
            logger.info("Discarded repetitive Whisper hallucination")
            return "", "ar"

        has_arabic = any(_is_arabic_letter(character) for character in cleaned_text)
        has_latin = False
        for character in cleaned_text:
            if not character.isalpha():
                continue
            if _is_arabic_letter(character):
                continue
            if _is_latin_letter(character):
                has_latin = True
                continue
            logger.info("Discarded transcription containing an unsupported language")
            return "", "unsupported"

        normalized_language = (detected_language or "").strip().lower().replace("_", "-")
        arabic_letter_count = sum(_is_arabic_letter(character) for character in cleaned_text)
        latin_letter_count = sum(_is_latin_letter(character) for character in cleaned_text)
        if normalized_language in {"ar", "arabic"} or normalized_language.startswith("ar-"):
            detected_language = "en" if latin_letter_count > arabic_letter_count else "ar"
        elif normalized_language in {"en", "english"} or normalized_language.startswith("en-"):
            has_at_least_as_many_arabic_letters = (
                arabic_letter_count >= latin_letter_count and arabic_letter_count > 0
            )
            detected_language = "ar" if has_at_least_as_many_arabic_letters else "en"
        elif detected_language:
            logger.info("Discarded Cloudflare transcription in language %s", detected_language)
            return "", "unsupported"
        elif (arabic_letter_count >= latin_letter_count and arabic_letter_count) or has_arabic:
            detected_language = "ar"
        elif latin_letter_count > 0 or has_latin:
            detected_language = "en"
        else:
            return "", "unsupported"

        logger.info("Cloudflare Whisper transcript [lang=%s]: %s", detected_language, cleaned_text)
        return cleaned_text, detected_language


stt_service = CloudflareWhisperSTTService()
