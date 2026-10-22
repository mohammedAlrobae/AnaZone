import base64
import logging
import re
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import DEFAULT_VOICE
from backend.services.llm_service import llm_service
from backend.services.tts_service import tts_service
from backend.services.agent_graph import agent_graph

logger = logging.getLogger("router_chat")
router = APIRouter(prefix="/api/chat", tags=["Text Chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    voice: Optional[str] = DEFAULT_VOICE
    is_muted: Optional[bool] = False
    location_context: Optional[str] = None
    location_name: Optional[str] = None
    country: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class GreetingRequest(BaseModel):
    voice: Optional[str] = DEFAULT_VOICE
    language: str = "en"

def parse_location_context(context_str: Optional[str]):
    """Extract location name, country, lat, lng from location context string."""
    if not context_str:
        return None, None, None, None
    lat, lng = None, None
    lat_match = re.search(r"lat:\s*([-\d\.]+)", context_str)
    lng_match = re.search(r"lng:\s*([-\d\.]+)", context_str)
    if lat_match:
        try:
            lat = float(lat_match.group(1))
        except ValueError:
            pass
    if lng_match:
        try:
            lng = float(lng_match.group(1))
        except ValueError:
            pass
    loc_clean = context_str.split("(")[0].strip()
    country = None
    if "," in loc_clean:
        parts = [p.strip() for p in loc_clean.split(",")]
        country = parts[-1]
    return loc_clean, country, lat, lng

@router.post("/greeting")
def greet_user(req: GreetingRequest):
    language = "ar" if req.language == "ar" else "en"
    instruction = (
        "ابدأ المحادثة بتحية مصرية طبيعية وودودة، وعرّف نفسك باختصار، "
        "ثم اسأل المستخدم كيف يمكنك مساعدته. اجعلها جملة أو جملتين."
        if language == "ar"
        else "Greet the user warmly and naturally, briefly introduce yourself, "
        "and ask how you can help. Keep it to one or two short sentences."
    )

    try:
        reply = llm_service.chat_completion([{"role": "user", "content": instruction}])
    except Exception as e:
        logger.error(f"Greeting generation error: {e}")
        raise HTTPException(status_code=500, detail="Could not generate a greeting")

    audio_b64 = None
    try:
        audio_bytes, _ = tts_service.synthesize(reply, voice_name=req.voice or DEFAULT_VOICE)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    except Exception as tts_err:
        logger.warning(f"Greeting audio generation notice: {tts_err}")

    return {"reply": reply, "audio_base64": audio_b64, "voice": req.voice, "language": language}

@router.post("")
def chat_with_agent(req: ChatRequest):
    """
    Direct text chat powered by LangGraph:
    - Routes user requests via state graph to:
      1. weather_node (Open-Meteo) for live real-time weather
      2. news_node (NewsData.io) for live news headlines
      3. general_info_node for location & conversational Q&A
    - Synthesizes speech with VoiceTut-TTS if not muted
    """
    try:
        # Detect language
        is_ar = bool(re.search(r"[\u0600-\u06FF]", req.message))
        lang = "ar" if is_ar else "en"

        # Resolve location details
        ctx_loc, ctx_country, ctx_lat, ctx_lng = parse_location_context(req.location_context)
        loc_name = req.location_name or ctx_loc
        country = req.country or ctx_country
        lat = req.lat if req.lat is not None else ctx_lat
        lng = req.lng if req.lng is not None else ctx_lng

        # Execute LangGraph workflow
        state_input = {
            "user_message": req.message,
            "history": [{"role": m.role, "content": m.content} for m in req.history or []],
            "location_name": loc_name,
            "country": country,
            "lat": lat,
            "lng": lng,
            "voice": req.voice,
            "language": lang,
        }

        graph_result = agent_graph.invoke(state_input)
        bot_reply = graph_result.get("reply_text") or "عذراً، لم أتمكن من إيجاد الرد المناسب حالياً."

        # Generate audio if not muted
        audio_b64 = None
        if not req.is_muted:
            try:
                audio_bytes, _ = tts_service.synthesize(bot_reply, voice_name=req.voice or DEFAULT_VOICE)
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            except Exception as tts_err:
                logger.warning(f"TTS generation notice in chat: {tts_err}")

        return {
            "reply": bot_reply,
            "audio_base64": audio_b64,
            "voice": req.voice,
            "is_muted": req.is_muted,
            "intent": graph_result.get("intent"),
            "weather_data": graph_result.get("weather_data"),
            "news_data": graph_result.get("news_data"),
            "is_place_specific": graph_result.get("is_place_specific"),
            "news_place_target": graph_result.get("news_place_target"),
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
