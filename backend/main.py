import os
import logging
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import voice, chat, graph_viz

# Set up logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LAUGHING_CAT_GIF = os.path.join(BASE_DIR, "laughing-cat.gif")

app = FastAPI(
    title="Arabic Voice AI Agent Backend",
    description="Voice agent using Cloudflare Whisper Turbo, streaming Groq inference, and Hugging Face TTS",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)

# Configure CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for frontend deployments
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(voice.router)
app.include_router(chat.router)
app.include_router(graph_viz.router)

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

@app.get("/docs", include_in_schema=False)
@app.get("/redoc", include_in_schema=False)
def docs_laughing_cat():
    if os.path.exists(LAUGHING_CAT_GIF):
        return FileResponse(LAUGHING_CAT_GIF, media_type="image/gif")
    return {"message": "Docs are private"}

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)

