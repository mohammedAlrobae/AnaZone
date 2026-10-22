import logging
import requests
from typing import List, Dict, Any
from backend.config import LLM_API_URL, LLM_MODEL, LLM_FALLBACK_MODEL, LLM_API_KEY

logger = logging.getLogger("llm_service")

SYSTEM_PROMPT = """أنت مساعد صوتي ذكي وودود ومستكشف للعالم. أجب دائماً بلغة آخر رسالة للمستخدم:
- إذا كانت رسالة المستخدم بالعربية: تحدث بالعامية المصرية الطبيعية، البسيطة، والودية جداً (عامية مصرية أصيلة عادية زي محادثات الناس اليومية، ولا تستخدم اللغة الفصحى إطلاقاً).
- إذا كانت رسالة المستخدم بالإنجليزية: تحدث بالإنجليزية الطبيعية والسلسة والواضحة (Natural, conversational English).

قواعد هامة جداً للمحادثة الصوتية:
1. إجاباتك موجزة ومباشرة وودية تناسب النطق الصوتي (جملتين إلى ثلاث جمل في المعتاد).
2. لا تستخدم علامات النجمة (*) أو الرموز التعبيرية (الإيموجي) أو جداول الماركداون داخل الإجابة لأن النص يُقرأ صوتياً بواسطة نظام تحويل النص إلى كلام (TTS).
3. عند ذكر درجات الحرارة أو الأرقام، اكتبها دائماً كأرقام صريحة (مثل 36°C أو 25 كم/س) ولا تكتبها ككلمات مفردة (لا تكتب ستة وثلاثين).
4. تحدث بأسلوب بشري جذاب وواقعي يعكس الشخصية المختارة.
5. كن جاهزاً للمساعدة في أي استفسار عام أو استكشاف على الخريطة. Keep the same selected speaker identity in both languages."""


class LLMService:
    def __init__(self):
        self.api_url = LLM_API_URL
        self.primary_model = LLM_MODEL
        self.fallback_model = LLM_FALLBACK_MODEL
        self.api_key = LLM_API_KEY

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 400
    ) -> str:
        """
        Calls the Groq Cloud chat completions endpoint with automatic fallback.
        Primary: openai/gpt-oss-120b (120B ultra-fast LPU inference)
        Fallback: qwen/qwen3.8-27b
        """
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]

        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key and self.api_key.lower() != "none":
            headers["Authorization"] = f"Bearer {self.api_key}"

        models_to_try = [self.primary_model, self.fallback_model]

        last_error = None
        for model in models_to_try:
            if not model:
                continue

            payload = {
                "model": model,
                "messages": formatted_messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }

            try:
                logger.info(f"Sending prompt to Groq Cloud endpoint {self.api_url} (model={model})...")
                response = requests.post(self.api_url, headers=headers, json=payload, timeout=25)

                if response.status_code == 200:
                    data = response.json()
                    choices = data.get("choices", [])
                    if choices:
                        reply_content = choices[0].get("message", {}).get("content", "").strip()
                        logger.info(f"Groq LLM ({model}) reply received: '{reply_content[:60]}...'")
                        return reply_content

                logger.warning(f"Groq model {model} returned status {response.status_code}: {response.text[:150]}")
                last_error = f"Status {response.status_code}: {response.text[:150]}"

            except Exception as e:
                logger.warning(f"Error calling Groq model {model}: {e}")
                last_error = str(e)

        raise RuntimeError(f"All Groq LLM models failed. Last error: {last_error}")


llm_service = LLMService()
