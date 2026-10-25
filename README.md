# 🌍 AnaZone — Real-Time Voice AI Companion & 3D Earth Explorer

<p align="center">
  <img src="frontend/public/confirmed.jpeg" alt="AnaZone Banner" width="100%" style="border-radius: 12px; max-height: 400px; object-fit: cover;" />
</p>

<p align="center">
  <strong>Every Coordinate Has a Story</strong><br />
  <em>Touch anywhere on the 3D globe to hear live breaking news, local weather, and rich history in natural human speech.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Next.js-16.4+-000000.svg?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/LangGraph-0.2+-2B5B84.svg?style=flat-square" alt="LangGraph" />
  <img src="https://img.shields.io/badge/STT-Cloudflare_Whisper_Turbo-F38020.svg?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Whisper" />
  <img src="https://img.shields.io/badge/TTS-VoiceTut--TTS_Egyptian-FFD21E.svg?style=flat-square&logo=huggingface&logoColor=black" alt="VoiceTut-TTS" />
  <img src="https://img.shields.io/badge/LLM-Groq_Cloud-F55036.svg?style=flat-square" alt="Groq Cloud" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
</p>

---

## 📖 Overview

**AnaZone** is a state-of-the-art planetary exploration and AI voice conversation platform. It bridges high-speed speech intelligence with photorealistic 3D geospatial exploration.

Users can tap anywhere on the 3D Earth or converse naturally in voice or text. AnaZone listens via sub-second edge speech-to-text, reasons using an autonomous LangGraph agent, fetches real-time atmospheric and news feeds, and replies with emotionally rich, human speech in both authentic Egyptian Arabic and English.

Built from the ground up on a **Zero-Retention architecture**, conversation history lives strictly in the visitor's browser memory—guaranteeing complete privacy with no persistent user tracking or database storage.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    User([👤 User / Microphone]) -->|PCM Audio Stream| Frontend[⚡ Next.js 16 Frontend App]
    Frontend -->|SSE / REST POST| Backend[🚀 FastAPI Gateway]

    subgraph Audio & Reasoning Pipeline
        Backend -->|Audio Bytes| CF[🌩️ Cloudflare Workers AI\nWhisper Large v3 Turbo]
        CF -->|Clean Transcript + Auto-Language Detection| LG[🧠 LangGraph Agent Workflow]
        
        LG --> Router{Intent Classifier}
        Router -->|Weather Query| Meteo[🌤️ Open-Meteo API\nLive Temperature, Humidity, Conditions]
        Router -->|News Query| News[📰 NewsData.io API\nLocalized Breaking Regional News]
        Router -->|General / History| Groq[⚡ Groq Cloud LLM\nStreaming Reasoning Engine]
        
        Meteo --> Synthesis[📝 Grounded Reply Synthesizer]
        News --> Synthesis
        Groq --> Synthesis
    end

    subgraph Speech Synthesis
        Synthesis -->|Clause-by-Clause Streaming| Splitter[✂️ Sentence & Pause Stream Splitter]
        Splitter -->|Target Dialect Phrases| TTS[🎙️ VoiceTut-TTS on Hugging Face\nDiffusion Model spk_01, spk_10, spk_18]
        TTS -->|Base64 WAV Chunks| Backend
    end

    Backend -->|Server-Sent Events (SSE)| Frontend
    Frontend -->|Live Waveform & Audio Queue| Speaker([🔊 User Headphones / Speakers])
    Frontend -->|Coordinates & Spatial Metadata| Globe[🌐 Google Photorealistic 3D Globe]
```

---

## ✨ Core Features

- **🎙️ Real-Time Voice Agent**:
  - Sub-second edge transcription via Cloudflare Workers AI Whisper Large v3 Turbo.
  - Streaming audio clause-by-clause dispatch on sentence terminals (`.`, `!`, `?`, `؟`) and natural mid-sentence pauses (`،`, `,`, `؛`).
  - Active VAD (Voice Activity Detection), RMS energy gating, and anti-hallucination suppression.
- **🗣️ Authentic Egyptian Arabic & English Voice Personas**:
  - **Yasmin (`spk_18_female`)**: Composed, professional, and clear tone.
  - **Ahmed (`spk_01_male`)**: Friendly, approachable conversational guide.
  - **Tareq (`spk_10_male`)**: High-energy, dynamic, and engaging persona.
  - Consistent speaker identity preserved across both Arabic and English.
- **🧠 Autonomous LangGraph Multi-Tool Agent**:
  - Live Weather via Open-Meteo (no API key needed, zero-cost, worldwide).
  - Breaking Local News via NewsData.io with country-code resolution and automatic fallback.
  - Global Geocoding for coordinates resolution directly from conversational queries.
- **🌐 Photorealistic 3D Earth Explorer**:
  - Interactive globe with real-time coordinate tracking and location HUD.
  - Quick-jump destinations (Pyramids of Giza, Tokyo, Paris, Dubai, New York, Petra).
  - Atmospheric multi-layer environmental rain effects.
- **🔒 Zero-Retention Privacy**:
  - Ephemeral in-memory chat session (cleared on page reload or tab close).
  - No database, no user tracking, no voice biometric data retained.
- **🌐 Dynamic Bilingual UI**:
  - Instant toggle between Arabic (RTL typography with LTR layout integrity) and English.
  - Dynamic `document.title` synchronization.

---

## 📂 Repository Structure

```text
AnaZone/
├── backend/
│   ├── main.py                  # FastAPI server entry point, CORS & routes
│   ├── config.py                # Environment variables & voice profile definitions
│   ├── streaming.py             # Server-Sent Events (SSE) & fast clause chunking
│   ├── Dockerfile               # Production container definition
│   ├── requirements.txt         # Backend Python dependencies
│   ├── routers/
│   │   ├── voice.py             # STT, TTS, pipeline & stream endpoints
│   │   ├── chat.py              # Text chat, greetings & suggestions
│   │   └── graph_viz.py         # LangGraph workflow visualizer endpoint
│   ├── services/
│   │   ├── agent_graph.py       # LangGraph state machine & tool nodes
│   │   ├── stt_service.py       # Cloudflare Workers AI Whisper integration
│   │   ├── tts_service.py       # Hugging Face VoiceTut-TTS client
│   │   └── llm_service.py       # Groq Cloud streaming inference
│   └── voice_samples/           # Pre-recorded audition audio samples
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx       # Root layout, HTML metadata & typography
│   │   │   ├── page.tsx         # Main page orchestration
│   │   │   ├── globals.css      # Core styles & custom animations
│   │   │   └── graph/page.tsx   # LangGraph visualizer interactive UI
│   │   ├── components/
│   │   │   ├── HeroSection.tsx  # Dynamic hero banner with responsive typography
│   │   │   ├── VoiceSelector.tsx# 3-voice persona selector & audio audition
│   │   │   ├── UnifiedVoiceChat.tsx # Mic capture, wave recorder & streaming SSE
│   │   │   ├── Google3DRealMap.tsx  # Photorealistic 3D globe & coordinates HUD
│   │   │   ├── Navbar.tsx       # Navigation bar & language switcher
│   │   │   └── Footer.tsx       # Modern footer with zero-retention privacy modal
│   │   └── lib/
│   │       ├── api.ts           # Type-safe API client & SSE chunk parser
│   │       ├── i18n.tsx         # English / Arabic internationalization store
│   │       └── wavRecorder.ts   # Hardware-synced 16-bit PCM WAV mic recorder
│   ├── package.json             # Frontend dependencies & Next.js scripts
│   └── next.config.ts           # Next.js configuration with Turbopack rules
│
├── .env.example                 # Clean environment variables template
├── Procfile                     # Render / Railway process file
├── vercel.json                  # Mono-repo configuration for Vercel
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## 🔑 Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

| Variable | Required | Description | Provider |
| :--- | :---: | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | **Yes** | Cloudflare API Token with Workers AI read access | [Cloudflare Dashboard](https://dash.cloudflare.com/) |
| `CLOUDFLARE_ACCOUNT_ID` | **Yes** | Cloudflare Account ID | [Cloudflare Dashboard](https://dash.cloudflare.com/) |
| `CLOUDFLARE_WHISPER_MODEL` | No | Defaults to `@cf/openai/whisper-large-v3-turbo` | Cloudflare Workers AI |
| `cloud_groq_api` / `GROQ_API_KEY` | **Yes** | Groq Cloud API Key for high-speed LLM inference | [Groq Console](https://console.groq.com/) |
| `LLM_MODEL` | No | Primary LLM model (default: `openai/gpt-oss-120b`) | Groq Cloud |
| `LLM_FALLBACK_MODEL` | No | Fallback LLM model (default: `qwen/qwen3.8-27b`) | Groq Cloud |
| `HF_TOKEN` | **Yes** | Hugging Face User Access Token (read permission) | [Hugging Face Settings](https://huggingface.co/settings/tokens) |
| `NEWSAPIKEY` | Optional | API Key for localized breaking news updates | [NewsData.io](https://newsdata.io/) |
| `NEXT_PUBLIC_API_URL` | No | Backend API URL (default: `http://localhost:8000`) | Frontend config |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Google Maps Platform Key for 3D Photorealistic Map | [Google Cloud Console](https://console.cloud.google.com/) |

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- **Python**: 3.11 or 3.12
- **Node.js**: 20+ or 22+ LTS
- **npm**: 10+

### 2. Backend Setup
```bash
# Navigate to the workspace root
cd AnaZone

# Create and activate virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI development server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Frontend Setup
```bash
# In a new terminal, navigate to the frontend directory
cd AnaZone/frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚢 Production Deployment

AnaZone is architected for **zero-cost tier hosting** with complete separation of concerns:

### 1. Backend (FastAPI) on Render / Railway
- **Option A: GitHub Integration with Procfile**:
  - Connect your GitHub repository to [Render](https://render.com).
  - Select **Web Service**.
  - Runtime: **Python 3**.
  - Build Command: `pip install -r backend/requirements.txt`.
  - Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
- **Option B: Docker Deployment**:
  - Point Dockerfile Path to `backend/Dockerfile`.
- Set Environment Variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `cloud_groq_api`, `HF_TOKEN`, `NEWSAPIKEY`).

### 2. Frontend (Next.js) on Vercel
- Connect your GitHub repository to [Vercel](https://vercel.com).
- Root directory is automatically resolved via [`vercel.json`](file:///d:/AnaZone/vercel.json) (`rootDirectory: "frontend"`).
- Framework preset: **Next.js**.
- Build command: `next build`.
- Add Environment Variable:
  - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g. `https://anazone-backend.onrender.com`).
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: (Optional) Your Google Maps key.

---

## 📡 REST & Streaming API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint returning `{"status": "healthy"}` |
| `GET` | `/api/voice/voices` | Returns active voice personas, roles, and audition sample URLs |
| `GET` | `/api/voice/sample/{voice_id}` | Streams pre-rendered WAV audio sample for the selected persona |
| `POST` | `/api/voice/transcribe` | Transcribes audio bytes via Cloudflare Whisper Turbo |
| `POST` | `/api/voice/synthesize` | Direct text-to-speech synthesis using VoiceTut-TTS |
| `POST` | `/api/voice/pipeline` | Complete end-to-end voice pipeline (STT ➡️ LangGraph ➡️ TTS) |
| `POST` | `/api/voice/pipeline/stream` | **Primary SSE Streaming Route**: streams transcript, tokens, and audio chunks |
| `POST` | `/api/chat` | Text-only chat interaction (bypasses TTS generation) |
| `POST` | `/api/chat/greeting` | Generates initial warm spoken audio greeting on session start |
| `GET` | `/api/graph/state` | Returns the LangGraph topology and node execution schema |

---

## 🛡️ Security & Zero-Retention Privacy

1. **No Data Storage**: Spoken audio and chat transcripts are processed strictly in-memory and immediately discarded after processing.
2. **CORS Hardened**: CORS middleware supports dynamic cloud environments with secure header handling.
3. **No Biometric Tracking**: Speech recognition produces transient textual transcripts without storing voice fingerprints or biometric vectors.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
