import os
import sys
import shutil
import time
from dotenv import dotenv_values
from gradio_client import Client

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
env = dotenv_values(env_path)
token = env.get("HF_TOKEN")

print("🎙️ Connecting to VoiceTut-TTS...")
client = Client("mohammedaly22/VoiceTut-TTS", token=token)

SAMPLES = [
    {
        "id": "1",
        "title": "خدمة عملاء ودعم فني احترافي (صوت أحمد)",
        "speaker": "spk_01_male",
        "filename": "sample_1_customer_service_ahmed.wav",
        "text": "أهلاً بك يا فندم في خدمة العملاء، يسعدني جداً مساعدتك النهاردة. ممكن تقولي إيه المشكلة اللي بتواجهك بالظبط عشان نحلها في أسرع وقت؟"
    },
    {
        "id": "2",
        "title": "مساعدة ذكاء اصطناعي تفاعلية (صوت مريم)",
        "speaker": "spk_15_female",
        "filename": "sample_2_ai_assistant_mariam.wav",
        "text": "صباح الخير! كل أمورك جاهزة والجدول بتاعك النهاردة مليان حاجات مهمة. تحب نبدأ بمراجعة المواعيد ولا نلخص الإيميلات الأول؟"
    },
    {
        "id": "3",
        "title": "إعلان تجاري وترويجي حماسي (صوت طارق)",
        "speaker": "spk_10_male",
        "filename": "sample_3_promo_tareq.wav",
        "text": "فرصتك الذهبية دلوقتي ما تتعوضش! خصومات حصرية بتوصل لخمسين في المية على كل المنتجات لفترة محدودة، اطلب دلوقتي وما تضيعش الفرصة!"
    },
    {
        "id": "4",
        "title": "بيئة عمل وتنسيق احترافي (صوت ياسمين)",
        "speaker": "spk_18_female",
        "filename": "sample_4_business_yasmin.wav",
        "text": "تمام، أنا راجعت الملف والتقارير كلها مظبوطة، هبعتلك النسخة النهائية عشان تعتمدها قبل نهاية اليوم إن شاء الله."
    },
    {
        "id": "5",
        "title": "نصيحة وسرد هادئ (صوت حسن)",
        "speaker": "spk_03_male",
        "filename": "sample_5_advice_hassan.wav",
        "text": "بص، أنا شايف إنك ما تستعجلش في القرار، خد وقتك وفكر فيه بهدوء الأول، وإن شاء الله كل الأمور هتتيسر."
    }
]

out_dir = os.path.dirname(os.path.abspath(__file__))
generated_files = []

for sample in SAMPLES:
    print(f"\n[{sample['id']}/{len(SAMPLES)}] 🎙️ توليد: {sample['title']}")
    print(f"    النص: « {sample['text']} »")
    print(f"    المتحدث: {sample['speaker']}")
    
    t0 = time.time()
    try:
        result = client.predict(
            text=sample["text"],
            language="ar",
            voice_mode="studio",
            speaker=sample["speaker"],
            ref_audio=None,
            ref_text="",
            num_step=32,
            guidance=3.0,
            speed=1.0,
            normalize=True,
            api_name="/synthesize"
        )
        
        src_wav = result[0]
        dst_wav = os.path.join(out_dir, sample["filename"])
        shutil.copy(src_wav, dst_wav)
        size = os.path.getsize(dst_wav)
        duration = time.time() - t0
        print(f"    ✅ تم التوليد بنجاح في {duration:.1f} ثانية! الحجم: {size:,} بايت")
        generated_files.append((sample, dst_wav, size))
    except Exception as e:
        print(f"    ❌ خطأ في العينة: {e}")

print("\n" + "=" * 60)
print(f"🎉 تم توليد {len(generated_files)} عينات بنجاح تام!")
print("=" * 60)
for sample, path, size in generated_files:
    print(f"- {sample['title']}: {path} ({size:,} bytes)")
