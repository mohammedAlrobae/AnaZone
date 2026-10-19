# 🚀 دليل تشغيل موديل VoiceTut-TTS محلياً (Local Inference / Offline)

تم تحميل أوزان الموديل بالكامل وحفظها في المجلد:
`3_VoiceTut_TTS/model_weights/`

---

## 📂 محتويات المجلد المحمل:
- **`model.safetensors`**: أوزان الموديل الأساسية بحجم (~2.45 GB).
- **`config.json`**: ملف ضبط وتكوين البنية المعمارية.
- **`tokenizer.json` & `tokenizer_config.json`**: ملفات معالجة النصوص.
- **`reference_speakers/`**: عينات الصوت المرجعية لجميع المتحدثين (ياسمين، طارق، أحمد، مريم، إلخ) مع ملف `references.json`.

---

## ⚙️ متطلبات التشغيل على كرت الشاشة (GPU):

1. **تثبيت PyTorch مع دعم CUDA:**
   ```bash
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
   ```

2. **تثبيت OmniVoice و VoiceTut-TTS:**
   ```bash
   pip install git+https://github.com/k2-fsa/OmniVoice.git
   pip install "voicetut-tts[web] @ git+https://github.com/MohammedAly22/VoiceTuT-TTS.git"
   ```

---

## 💻 طريقة تشغيل الموديل باستخدام الأوزان المحلية (بدون إنترنت):

### 1. تشغيل واجهة الويب التفاعلية (Web UI):
```powershell
$env:VOICETUT_CKPT="3_VoiceTut_TTS/model_weights"
voicetut-tts-server --port 7860
```

### 2. التشغيل عبر كود بايثون مباشرة:
```python
import os
import torch
from voicetut_tts import VoiceTutTTS

# مسار مجلد الأوزان المحلية
weights_path = os.path.abspath("3_VoiceTut_TTS/model_weights")

# تحميل الموديل على كرت الشاشة
tts = VoiceTutTTS.from_pretrained(weights_path, device="cuda" if torch.cuda.is_available() else "cpu")

# توليد الصوت بصوت ياسمين
audio = tts.synthesize(
    text="أهلاً بك، تم إعداد وتشغيل الموديل محلياً بنجاح تام!",
    speaker="spk_18_female" # ياسمين
)
audio.save("output_local.wav")
```
