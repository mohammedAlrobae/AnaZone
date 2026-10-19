import base64
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.config import DEFAULT_VOICE
from backend.services.llm_service import llm_service
from backend.services.tts_service import tts_service

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

class GreetingRequest(BaseModel):
    voice: Optional[str] = DEFAULT_VOICE
    language: str = "en"

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
        logger.warning(f"Greeting audio generation error: {tts_err}")

    return {"reply": reply, "audio_base64": audio_b64, "voice": req.voice, "language": language}

@router.post("")
def chat_with_agent(req: ChatRequest):
    """
    Direct text chat with the agent:
    - Queries LLM (claude-sonnet-9)
    - If is_muted == False, also generates TTS audio with the chosen voice
    - If is_muted == True, acts like ChatGPT (text only)
    """
    try:
        # Build message history for LLM
        messages = [{"role": m.role, "content": m.content} for m in req.history or []]
        if req.location_context:
            messages.append({
                "role": "system",
                "content": (
                    f"The user is exploring this location: {req.location_context}. "
                    "Use it as context, and answer in the same language as the user's latest message."
                )
            })
        messages.append({"role": "user", "content": req.message})

        # Get LLM reply
        bot_reply = llm_service.chat_completion(messages)

        # Generate audio if not muted
        audio_b64 = None
        if not req.is_muted:
            try:
                audio_bytes, _ = tts_service.synthesize(bot_reply, voice_name=req.voice or DEFAULT_VOICE)
                audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            except Exception as tts_err:
                logger.warning(f"TTS generation error in chat: {tts_err}")

        return {
            "reply": bot_reply,
            "audio_base64": audio_b64,
            "voice": req.voice,
            "is_muted": req.is_muted
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
