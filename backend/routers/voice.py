import base64
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from pydantic import BaseModel

from backend.config import VOICE_PROFILES, DEFAULT_VOICE
from backend.services.stt_service import stt_service
from backend.services.llm_service import llm_service
from backend.services.tts_service import tts_service

logger = logging.getLogger("router_voice")
router = APIRouter(prefix="/api/voice", tags=["Voice Agent"])

class SynthesizeRequest(BaseModel):
    text: str
    voice: Optional[str] = DEFAULT_VOICE

class PipelineRequest(BaseModel):
    audio_base64: str
    voice: Optional[str] = DEFAULT_VOICE
    history: Optional[List[Dict[str, str]]] = []
    is_muted: Optional[bool] = False
    location_context: Optional[str] = None

class ExploreLocationRequest(BaseModel):
    location_name: str
    country: Optional[str] = ""
    city: Optional[str] = ""
    lat: Optional[float] = 0.0
    lng: Optional[float] = 0.0
    voice: Optional[str] = DEFAULT_VOICE
    is_muted: Optional[bool] = False
    language: Optional[str] = "ar"

@router.get("/voices")
def get_voices():
    """Returns the list of curated Arabic voices."""
    voices_list = []
    for key, val in VOICE_PROFILES.items():
        voices_list.append({
            "id": val["id"],
            "speaker_id": val["speaker_id"],
            "name_ar": val["name_ar"],
            "gender": val["gender"],
            "role": val["role"],
            "description": val["description"],
            "sample_url": f"/api/voice/sample/{val['id']}"
        })
    return {"voices": voices_list, "default": DEFAULT_VOICE}

@router.get("/sample/{voice_id}")
def get_voice_sample(voice_id: str, lang: Optional[str] = "ar"):
    """Streams a voice audition in the requested language for the selected speaker."""
    audio_data = tts_service.get_sample_audio(voice_id, language=lang or "ar")
    if not audio_data:
        raise HTTPException(status_code=404, detail=f"Sample audio for voice '{voice_id}' not found")
    return Response(content=audio_data, media_type="audio/wav")

@router.post("/transcribe")
async def transcribe_audio(
    file: Optional[UploadFile] = File(None),
    audio_base64: Optional[str] = Form(None)
):
    """
    Transcribes Arabic and English speech using Cloudflare Workers AI Whisper.
    """
    try:
        if file is not None:
            audio_bytes = await file.read()
        elif audio_base64:
            # Handle data URL prefix if present
            raw_b64 = audio_base64.split(",")[-1]
            audio_bytes = base64.b64decode(raw_b64)
        else:
            raise HTTPException(status_code=400, detail="No audio file or base64 data provided")

        text, lang = stt_service.transcribe(audio_bytes, language=None)
        return {"text": text, "language": lang}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"STT Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/synthesize")
def synthesize_speech(req: SynthesizeRequest):
    """
    Synthesizes speech using VoiceTut-TTS with chosen voice.
    """
    try:
        audio_bytes, mime_type = tts_service.synthesize(req.text, voice_name=req.voice or DEFAULT_VOICE)
        b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
        return {
            "text": req.text,
            "voice": req.voice,
            "mime_type": mime_type,
            "audio_base64": b64_audio
        }
    except Exception as e:
        logger.error(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pipeline")
def run_voice_pipeline(req: PipelineRequest):
    """
    Full End-to-End Voice Agent Pipeline:
    1. Transcribe audio with Cloudflare Workers AI Whisper and detect Arabic or English
    2. Infer Reply (Claude Sonnet 9)
    3. Synthesize Speech (VoiceTut-TTS with selected voice) if not muted
    """
    try:
        # Step 1: Decode Audio & Transcribe with auto AR/EN detection
        raw_b64 = req.audio_base64.split(",")[-1]
        audio_bytes = base64.b64decode(raw_b64)
        user_text, detected_lang = stt_service.transcribe(audio_bytes, language=None)

        if not user_text:
            return {
                "user_text": "",
                "bot_text": "عذراً، لم أتمكن من سماعك بوضوح. هل يمكنك إعادة المحاولة؟",
                "audio_base64": None,
                "voice": req.voice,
                "is_muted": req.is_muted,
                "language": detected_lang
            }

        # Step 2: LLM chat
        conversation = list(req.history or [])
        if req.location_context:
            conversation.append({
                "role": "system",
                "content": (
                    f"The user is exploring this location: {req.location_context}. "
                    "Use it as context, and answer in the same language as the user's latest message."
                )
            })
        conversation.append({"role": "user", "content": user_text})

        bot_text = llm_service.chat_completion(conversation)

        # Step 3: TTS (if not muted)
        audio_reply_b64 = None
        if not req.is_muted:
            try:
                tts_bytes, _ = tts_service.synthesize(bot_text, voice_name=req.voice or DEFAULT_VOICE)
                audio_reply_b64 = base64.b64encode(tts_bytes).decode("utf-8")
            except Exception as tts_err:
                logger.warning(f"TTS synthesis warning in pipeline: {tts_err}")

        return {
            "user_text": user_text,
            "bot_text": bot_text,
            "audio_base64": audio_reply_b64,
            "voice": req.voice,
            "is_muted": req.is_muted,
            "language": detected_lang
        }
    except Exception as e:
        logger.error(f"Pipeline Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/explore-location")
def explore_location(req: ExploreLocationRequest):
    """
    Geographic Exploration Briefing:
    When a user clicks any location/coordinates on the world map:
    1. Generates an engaging, educational 2-3 sentence introduction in Egyptian Arabic (or English).
    2. Synthesizes voice audio with VoiceTut-TTS.
    3. Prepares context for continuous deep Q&A.
    """
    try:
        is_ar = req.language != "en"
        loc_str = req.location_name
        if req.country and req.country not in req.location_name:
            loc_str += f", {req.country}"

        latitude = req.lat if req.lat is not None else 0.0
        longitude = req.lng if req.lng is not None else 0.0

        if is_ar:
            prompt = (
                f"أنت مرشد جغرافي ومستكشف سياحي ممتع جداً في تطبيق استكشاف العالم.\n"
                f"نقر المستخدم على الخريطة عند هذا الموقع:\n"
                f"- المكان: {loc_str}\n"
                f"- الإحداثيات: {latitude:.4f}, {longitude:.4f}\n\n"
                f"المطلوب منك:\n"
                f"قدّم نبذة شيقة وجذابة وموجزة جداً (جملتين إلى ثلاث جمل فقط) عن هذا المكان بالعامية المصرية الودية اللطيفة.\n"
                f"تحدث عن أهم ما يميّزه (تاريخ، أو معالم، أو ثقافة، أو معلومة ممتعة)، واختم بسؤال ودي يدعو المستخدم لسؤالك أو استكشاف تفاصيل أكثر.\n"
                f"هام جداً: لا تستخدم رموز تعبيرية (إيموجي) أو نجوم (*) أو جداول إطلاقاً لأن النص سيتم نطقه صوتياً بواسطة نظام تحويل النص إلى كلام (TTS)."
            )
        else:
            prompt = (
                f"You are a friendly, knowledgeable world geography explorer and travel guide.\n"
                f"The user clicked this location on the world map:\n"
                f"- Location: {loc_str}\n"
                f"- Coordinates: {latitude:.4f}, {longitude:.4f}\n\n"
                f"Provide a captivating, educational, and concise 2-3 sentence introduction about this place in a warm, engaging tone.\n"
                f"Highlight what makes it unique (landmarks, geography, or fascinating history), and end with an inviting question inviting the user to ask deeper questions.\n"
                f"Important: Do not use emojis, asterisks (*), or markdown tables as this text will be directly spoken aloud by TTS."
            )

        messages = [
            {"role": "user", "content": prompt}
        ]
        bot_text = llm_service.chat_completion(messages, max_tokens=250)

        audio_reply_b64 = None
        if not req.is_muted:
            try:
                tts_bytes, _ = tts_service.synthesize(bot_text, voice_name=req.voice or DEFAULT_VOICE)
                audio_reply_b64 = base64.b64encode(tts_bytes).decode("utf-8")
            except Exception as tts_err:
                logger.warning(f"TTS synthesis warning in explore_location: {tts_err}")

        return {
            "location_name": req.location_name,
            "country": req.country,
            "city": req.city,
            "lat": req.lat,
            "lng": req.lng,
            "intro_text": bot_text,
            "audio_base64": audio_reply_b64,
            "voice": req.voice,
            "is_muted": req.is_muted
        }
    except Exception as e:
        logger.error(f"Explore Location Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
