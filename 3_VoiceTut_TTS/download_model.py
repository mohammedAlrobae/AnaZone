import os
import sys
import time
from dotenv import dotenv_values
from huggingface_hub import snapshot_download

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Base directory
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(os.path.dirname(current_dir), ".env")
env = dotenv_values(env_path) if os.path.exists(env_path) else {}
hf_token = env.get("HF_TOKEN")

# Target directory for the local weights
target_dir = os.path.join(current_dir, "model_weights")
os.makedirs(target_dir, exist_ok=True)

repo_id = "mohammedaly22/VoiceTut-TTS"
print(f"📦 Starting download for {repo_id}...")
print(f"📂 Destination folder: {target_dir}")
print(f"🔑 Using HF_TOKEN: {'Yes' if hf_token else 'No (Anonymous)'}")

start_time = time.time()
try:
    downloaded_path = snapshot_download(
        repo_id=repo_id,
        local_dir=target_dir,
        token=hf_token,
        repo_type="model",
        resume_download=True
    )
    elapsed = time.time() - start_time
    print(f"\n✅ Download completed successfully in {elapsed:.1f} seconds!")
    print(f"📁 Files saved at: {downloaded_path}")
except Exception as e:
    print(f"\n❌ Error during download: {e}")
    sys.exit(1)
