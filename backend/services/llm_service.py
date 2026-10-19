import logging
import requests
from typing import List, Dict, Any
from backend.config import LLM_API_URL, LLM_MODEL, LLM_API_KEY

logger = logging.getLogger("llm_service")

SYSTEM_PROMPT = """أنت مساعد صوتي ذكي وودود ومستكشف للعالم. أجب دائماً بلغة آخر رسالة للمستخدم:
- إذا كانت رسالة المستخدم بالعربية: تحدث بالعامية المصرية الطبيعية، البسيطة، والودية جداً (عامية مصرية أصيلة عادية زي محادثات الناس اليومية، ولا تستخدم اللغة الفصحى إطلاقاً).
- إذا كانت رسالة المستخدم بالإنجليزية: تحدث بالإنجليزية الطبيعية والسلسة والواضحة (Natural, conversational English).

قواعد هامة جداً للمحادثة الصوتية:
1. إجاباتك موجزة ومباشرة وودية تناسب النطق الصوتي (جملتين إلى ثلاث جمل في المعتاد).
2. لا تستخدم علامات النجمة (*) أو الرموز التعبيرية (الإيموجي) أو جداول الماركداون داخل الإجابة لأن النص يُقرأ صوتياً بواسطة نظام تحويل النص إلى كلام (TTS).
3. تحدث بأسلوب بشري جذاب وواقعي يعكس الشخصية المختارة.
4. كن جاهزاً للمساعدة في أي استفسار عام أو استكشاف على الخريطة. Keep the same selected speaker identity in both languages."""

class LLMService:
    def __init__(self):
        self.api_url = LLM_API_URL
        self.model = LLM_MODEL
        self.api_key = LLM_API_KEY

    def chat_completion(self, messages: List[Dict[str, str]], temperature: float = 0.7, max_tokens: int = 400) -> str:
        """
        Calls the LLM chat completions endpoint (claude-sonnet-9).
        """
        # Ensure system prompt is present
        formatted_messages = [{"role": "system", "content": SYSTEM_PROMPT}, *messages]

        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key and self.api_key.lower() != "none":
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "messages": formatted_messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        logger.info(f"Sending prompt to LLM endpoint {self.api_url} (model={self.model})...")
        response = requests.post(self.api_url, headers=headers, json=payload, timeout=30)

        if response.status_code != 200:
            error_msg = f"LLM API returned status {response.status_code}: {response.text}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError(f"No choices returned from LLM: {data}")

        reply_content = choices[0].get("message", {}).get("content", "").strip()
        logger.info(f"LLM reply received: '{reply_content[:60]}...'")
        return reply_content

llm_service = LLMService()
