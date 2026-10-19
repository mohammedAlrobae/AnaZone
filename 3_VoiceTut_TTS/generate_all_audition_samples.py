import os
import sys
import torch
import soundfile as sf
from voicetut_tts import VoiceTutTTS

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(ROOT_DIR, "model_weights")

# 100% Egyptian Dialect (عامية مصرية طبيعية جداً وبدون فصحى)
SAMPLES = [
    {
        "id": "yasmin_ar",
        "voice": "yasmin",
        "speaker": "spk_18_female",
        "lang": "ar",
        "filename": "sample_yasmin.wav",
        "text": "أهلاً بحضرتك، أنا ياسمين. هكون معاك خطوة بخطوة عشان ندردش وكمان نستكشف أي مكان على الخريطة بكل هدوء وبساطة."
    },
    {
        "id": "yasmin_en",
        "voice": "yasmin",
        "speaker": "spk_18_female",
        "lang": "en",
        "filename": "sample_yasmin_en.wav",
        "text": "Welcome, I am Yasmin. I will be with you step by step to chat and explore any location on the map with calm precision."
    },
    {
        "id": "ahmed_ar",
        "voice": "ahmed",
        "speaker": "spk_01_male",
        "lang": "ar",
        "filename": "sample_ahmed.wav",
        "text": "يا هلا بيك! أنا أحمد، مبسوط إني معاك النهاردة وجاهز أساعدك في أي وقت، يلا نلف العالم ونستكشف سوا!"
    },
    {
        "id": "ahmed_en",
        "voice": "ahmed",
        "speaker": "spk_01_male",
        "lang": "en",
        "filename": "sample_ahmed_en.wav",
        "text": "Hello there! I am Ahmed, really glad to be with you today. Ready to help anytime, let's explore the world together!"
    },
    {
        "id": "tareq_ar",
        "voice": "tareq",
        "speaker": "spk_10_male",
        "lang": "ar",
        "filename": "sample_tareq.wav",
        "text": "إيه الأخبار يا بطل؟ أنا طارق! جاهز لرحلة حماسية نلف بيها الدنيا؟ دوس على أي مكان على الخريطة ويلا بينا!"
    },
    {
        "id": "tareq_en",
        "voice": "tareq",
        "speaker": "spk_10_male",
        "lang": "en",
        "filename": "sample_tareq_en.wav",
        "text": "What's up! I am Tareq! Ready for an exciting adventure around the globe? Click anywhere on the map and let's go!"
    }
]

def main():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Loading VoiceTutTTS from '{WEIGHTS_PATH}' on '{device}' to bake static samples...")
    engine = VoiceTutTTS.from_pretrained(WEIGHTS_PATH, device=device)
    print("VoiceTutTTS engine loaded.")

    for s in SAMPLES:
        out_path = os.path.join(ROOT_DIR, s["filename"])
        print(f"\nSynthesizing {s['id']} ({s['speaker']}, lang={s['lang']})...")
        print(f"Text: {s['text']}")
        audio_array = engine.synthesize(
            text=s["text"],
            speaker=s["speaker"],
            language=s["lang"]
        )
        sf.write(out_path, audio_array, 24000, format="WAV")
        size = os.path.getsize(out_path)
        print(f"Baked {s['filename']}: {size:,} bytes")

    print("\nAll 6 Egyptian & English static audition samples baked successfully!")

if __name__ == "__main__":
    main()
