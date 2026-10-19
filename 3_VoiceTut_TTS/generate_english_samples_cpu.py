import os
from pathlib import Path

import soundfile as sf
import torch
from voicetut_tts import VoiceTutTTS

ROOT_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = ROOT_DIR / "model_weights"
SAMPLE_TEXT = "Hello, I'm here to help. What would you like to talk about today?"
SAMPLE_RATE = 24000

VOICES = [
    ("ahmed", "spk_01_male"),
    ("tareq", "spk_10_male"),
    ("yasmin", "spk_18_female"),
]


def main() -> None:
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    engine = VoiceTutTTS.from_pretrained(str(WEIGHTS_PATH), device="cpu")
    generated_files: list[tuple[Path, Path]] = []

    try:
        for voice_name, speaker_id in VOICES:
            temporary_path = ROOT_DIR / f".sample_{voice_name}_en.generated.wav"
            sample_path = ROOT_DIR / f"sample_{voice_name}_en.wav"
            audio = engine.synthesize(text=SAMPLE_TEXT, speaker=speaker_id)
            sf.write(temporary_path, audio, SAMPLE_RATE, format="WAV")

            audio_bytes = temporary_path.read_bytes()
            if not audio_bytes.startswith(b"RIFF") or audio_bytes[8:12] != b"WAVE":
                raise RuntimeError(f"VoiceTut generated an invalid WAV sample for {voice_name}")

            generated_files.append((temporary_path, sample_path))
            print(f"Generated English audition for {voice_name} with {speaker_id}")

        for temporary_path, sample_path in generated_files:
            temporary_path.replace(sample_path)
    finally:
        for temporary_path, _ in generated_files:
            temporary_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
