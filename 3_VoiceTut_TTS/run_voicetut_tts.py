"""
VoiceTut-TTS Generator Script (Egyptian Native Arabic)
======================================================
"""

import os
import sys
import shutil
from dotenv import dotenv_values
from gradio_client import Client

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")


def get_hf_token():
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_path):
        config = dotenv_values(env_path)
        token = config.get("HF_TOKEN")
        if token and token.strip() not in ["", "none", "your_token_here"]:
            return token.strip()
    return None


def generate_speech(text: str, speaker_id: str = "spk_01_male", output_filename: str = "voicetut_sample.wav"):
    hf_token = get_hf_token()
    print(f"🎙️ Connecting to VoiceTut-TTS space (Token: {'Enabled' if hf_token else 'Anonymous'})...")
    
    if hf_token:
        client = Client("mohammedaly22/VoiceTut-TTS", token=hf_token)
    else:
        client = Client("mohammedaly22/VoiceTut-TTS")

    print(f"🎙️ Synthesizing Egyptian speech for: '{text}'")
    print(f"   Speaker: {speaker_id}")

    try:
        result = client.predict(
            text=text,
            language="ar",
            voice_mode="studio",
            speaker=speaker_id,
            ref_audio=None,
            ref_text="",
            num_step=32,
            guidance=3.0,
            speed=1.0,
            normalize=True,
            api_name="/synthesize"
        )

        src_wav = result[0]
        out_dir = os.path.dirname(os.path.abspath(__file__))
        dst_wav = os.path.join(out_dir, output_filename)
        shutil.copy(src_wav, dst_wav)
        size = os.path.getsize(dst_wav)
        print(f"✅ Generated successfully: {dst_wav} ({size:,} bytes)")
        return dst_wav
    except Exception as e:
        print(f"\n❌ ZeroGPU Notice: {e}")
        print("💡 Solution: Get a free token from https://huggingface.co/settings/tokens and add it to .env as HF_TOKEN=hf_...")
        return None


VOICE_PRESETS = {
    "yasmin": {
        "speaker_id": "spk_18_female",
        "description": "صوت ياسمين - بيئة عمل وتنسيق احترافي وهادئ (مؤنث)"
    },
    "tareq": {
        "speaker_id": "spk_10_male",
        "description": "صوت طارق - إعلانات وترويج حماسي وقوي (مذكر)"
    },
    "ahmed": {
        "speaker_id": "spk_01_male",
        "description": "صوت أحمد - خدمة عملاء ودعم فني وودي (مذكر)"
    }
}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="VoiceTut-TTS Generator (مع الأصوات المعتمدة)")
    parser.add_argument("text", nargs="?", default="يا باشا منور والله، إيه الأخبار وعامل إيه في يومك النهاردة؟", help="النص العربي المراد تحويله إلى صوت")
    parser.add_argument("-v", "--voice", choices=["yasmin", "tareq", "ahmed"], default="yasmin", help="الصوت المعتمد (yasmin, tareq, ahmed)")
    parser.add_argument("-s", "--speaker", default=None, help="معرف المتحدث المباشر (مثل spk_18_female)")
    parser.add_argument("-o", "--output", default=None, help="اسم ملف الإخراج (wav)")
    args = parser.parse_args()

    selected_speaker = args.speaker
    voice_name = args.voice

    if not selected_speaker:
        preset = VOICE_PRESETS.get(voice_name, VOICE_PRESETS["yasmin"])
        selected_speaker = preset["speaker_id"]
        print(f"✨ الصوت المعتمد: {preset['description']}")

    output_file = args.output or f"output_{voice_name}.wav"
    generate_speech(args.text, speaker_id=selected_speaker, output_filename=output_file)

