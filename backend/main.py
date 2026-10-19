import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import voice, chat

# Set up logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

app = FastAPI(
    title="Arabic Voice AI Agent Backend",
    description="Clean, modular backend powering Arabic Voice Agent with Cloudflare Whisper v3 Turbo, Claude Sonnet 9, and VoiceTut-TTS",
    version="1.0.0"
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev and flexibility
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(voice.router)
app.include_router(chat.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "Arabic Voice AI Agent Backend",
        "endpoints": {
            "voices": "/api/voice/voices",
            "transcribe": "/api/voice/transcribe",
            "synthesize": "/api/voice/synthesize",
            "pipeline": "/api/voice/pipeline",
            "chat": "/api/chat",
            "docs": "/docs"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
