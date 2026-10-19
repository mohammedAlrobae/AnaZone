import os
import sys
import torch
import soundfile as sf
from voicetut_tts import VoiceTutTTS

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(ROOT_DIR, "model_weights")

# The exact same professional Egyptian dialect greeting for all 3 voices:
GREETING_TEXT = "أهلاً بحضرتك، أنا معاك وجاهز أساعدك النهاردة، إزاي أقدر أخدمك؟"

VOICES = [
    {"id": "ahmed", "speaker": "spk_01_male", "filename": "sample_ahmed.wav"},
    {"id": "tareq", "speaker": "spk_10_male", "filename": "sample_tareq.wav"},
    {"id": "yasmin", "speaker": "spk_18_female", "filename": "sample_yasmin.wav"},
]

def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading VoiceTutTTS from '{WEIGHTS_PATH}' on '{device}'...")
    engine = VoiceTutTTS.from_pretrained(WEIGHTS_PATH, device=device)
    print("Engine loaded.")

    for v in VOICES:
        print(f"Synthesizing for {v['id']} ({v['speaker']})...")
        audio_array = engine.synthesize(text=GREETING_TEXT, speaker=v["speaker"])
        out_path = os.path.join(ROOT_DIR, v["filename"])
        sf.write(out_path, audio_array, 24000, format="WAV")
        print(f"Saved {v['id']} sample to {out_path} ({os.path.getsize(out_path)} bytes)")

if __name__ == "__main__":
    main()
