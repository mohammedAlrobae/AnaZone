import os
from pathlib import Path
from dotenv import dotenv_values

# Locate root directory and .env file
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

env_config = dotenv_values(ENV_PATH) if ENV_PATH.exists() else {}

def get_env(key: str, default: str = "") -> str:
    val = env_config.get(key) or os.environ.get(key) or default
    return val.strip() if isinstance(val, str) else default

# Cloudflare Configuration
CLOUDFLARE_API_TOKEN = get_env("CLOUDFLARE_API_TOKEN")
CLOUDFLARE_ACCOUNT_ID = get_env("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_WHISPER_MODEL = "@cf/openai/whisper-large-v3-turbo"

# LLM Configuration
LLM_API_URL = get_env("LLM_API_URL", "http://127.0.0.1:4000/v1/chat/completions")
LLM_MODEL = get_env("LLM_MODEL", "claude-sonnet-9")
LLM_API_KEY = get_env("LLM_API_KEY", "none")

# HuggingFace & VoiceTut-TTS Configuration
HF_TOKEN = get_env("HF_TOKEN")
VOICETUT_SPACE = "mohammedaly22/VoiceTut-TTS"

# Voice Profiles
VOICE_PROFILES = {
    "ahmed": {
        "id": "ahmed",
        "speaker_id": "spk_01_male",
        "name_ar": "أحمد",
        "gender": "ذكر",
        "role": "خدمة عملاء ودعم فني وودي",
        "description": "صوت أحمد المصري - ودود ومناسب للمحادثات اليومية وخدمة العملاء",
        "sample_filename": "sample_ahmed.wav"
    },
    "tareq": {
        "id": "tareq",
        "speaker_id": "spk_10_male",
        "name_ar": "طارق",
        "gender": "ذكر",
        "role": "إعلانات وترويج حماسي وقوي",
        "description": "صوت طارق المصري - حماسي، قوي ومناسب للتقديم والإقناع",
        "sample_filename": "sample_tareq.wav"
    },
    "yasmin": {
        "id": "yasmin",
        "speaker_id": "spk_18_female",
        "name_ar": "ياسمين",
        "gender": "أنثى",
        "role": "بيئة عمل وتنسيق احترافي وهادئ",
        "description": "صوت ياسمين المصري - هادئ، واثق ومناسب لبيئة العمل والاستشارات",
        "sample_filename": "sample_yasmin.wav"
    }
}

DEFAULT_VOICE = "yasmin"
