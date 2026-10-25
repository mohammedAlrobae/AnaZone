import os
import re
import logging
from typing import Optional, Tuple
from gradio_client import Client

from backend.config import VOICE_PROFILES, DEFAULT_VOICE, VOICETUT_SPACE, HF_TOKEN, ROOT_DIR

logger = logging.getLogger("tts_service")

# Map of voice IDs to VoiceTut speaker IDs
SPEAKER_MAP = {
    "ahmed": "spk_01_male",     # Customer service & friendly (Ahmed)
    "tareq": "spk_10_male",     # Promo & energetic (Tareq)
    "yasmin": "spk_18_female",  # Professional & calm (Yasmin)
}

def clean_text_for_tts(text: str) -> str:
    """Removes reasoning tags, markdown symbols, brackets, and emojis for clean Arabic TTS synthesis."""
    text = re.sub(r"<think>[\s\S]*?</think>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[\*\_#`~>]", "", text)
    text = re.sub(r"\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

class RemoteVoiceTutTTSService:
    """
    HuggingFace Cloud VoiceTut-TTS Service:
    - Runs 100% in HuggingFace Cloud on dedicated A10G GPU (mohammedaly22/VoiceTut-TTS).
    - Consumes 0 local CPU, 0 local GPU, 0 local VRAM on the user's machine.
    """
    def __init__(self):
        self._client: Optional[Client] = None
        self.space_name = VOICETUT_SPACE
        self.hf_token = HF_TOKEN

    def _get_client(self) -> Client:
        if self._client is None:
            logger.info(f"Connecting to remote VoiceTut-TTS Space on HuggingFace: '{self.space_name}'...")
            self._client = Client(self.space_name, token=self.hf_token)
            logger.info("Connected to remote VoiceTut-TTS Space successfully.")
        return self._client

    def synthesize(self, text: str, voice_name: str = DEFAULT_VOICE) -> Tuple[bytes, str]:
        clean_text = clean_text_for_tts(text)
        if not clean_text:
            raise ValueError("No valid text provided for TTS")

        voice_key = voice_name.lower().strip()
        speaker_id = SPEAKER_MAP.get(voice_key, SPEAKER_MAP[DEFAULT_VOICE])
        synthesis_language = "Arabic" if re.search(r"[\u0600-\u06FF]", clean_text) else "English"

        logger.info(
            f"Remote VoiceTut-TTS Synthesizing: voice='{voice_key}', "
            f"language='{synthesis_language}', text='{clean_text[:60]}'..."
        )

        try:
            client = self._get_client()
            # Call remote HuggingFace Space endpoint (/synthesize)
            result = client.predict(
                text=clean_text,
                language=synthesis_language,
                voice_mode="studio",
                speaker=speaker_id,
                ref_audio=None,
                ref_text="",
                num_step=16,
                guidance=2.5,
                speed=1.0,
                normalize=True,
                api_name="/synthesize"
            )

            audio_filepath = result[0] if isinstance(result, (tuple, list)) else result
            if not audio_filepath or not os.path.exists(audio_filepath):
                raise RuntimeError(f"Failed to retrieve synthesized audio from remote Space: {result}")

            with open(audio_filepath, "rb") as f:
                wav_bytes = f.read()

            # Clean up temporary download file from gradio_client to prevent disk leaks
            try:
                if os.path.isfile(audio_filepath):
                    os.remove(audio_filepath)
            except Exception as rm_err:
                logger.debug(f"Could not remove temp audio file: {rm_err}")

            logger.info(f"VoiceTut-TTS dynamic synthesis complete: {len(wav_bytes):,} bytes received for voice '{voice_key}'.")
            return wav_bytes, "audio/wav"

        except Exception as e:
            # Invalidate cached client so subsequent calls reconnect cleanly
            self._client = None
            logger.error(f"Hugging Face VoiceTut-TTS synthesis failed: {e}")
            raise RuntimeError(f"VoiceTut-TTS synthesis error: {e}")

    def get_sample_audio(self, voice_name: str, language: str = "ar") -> Optional[bytes]:
        """Returns a language-matched audition using the selected speaker identity."""
        voice_key = voice_name.lower().strip()
        profile = VOICE_PROFILES.get(voice_key)
        if not profile:
            return None

        if language.lower() == "en":
            sample_filename = f"sample_{voice_key}_en.wav"
        else:
            sample_filename = profile["sample_filename"]

        # Check backend/voice_samples first, then fallback to 3_VoiceTut_TTS
        sample_path = ROOT_DIR / "backend" / "voice_samples" / sample_filename
        if not sample_path.is_file():
            sample_path = ROOT_DIR / "3_VoiceTut_TTS" / sample_filename
        if not sample_path.is_file():
            return None

        with open(sample_path, "rb") as sample_file:
            audio_bytes = sample_file.read()

        if not audio_bytes.startswith(b"RIFF") or audio_bytes[8:12] != b"WAVE":
            raise RuntimeError(f"Voice sample for '{voice_key}' ({language}) is not a valid WAV file: {sample_path}")

        return audio_bytes

tts_service = RemoteVoiceTutTTSService()
