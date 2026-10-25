import logging
import json
from typing import Callable, Dict, List

import requests
from backend.config import LLM_API_URL, LLM_MODEL, LLM_FALLBACK_MODEL, LLM_API_KEY

logger = logging.getLogger("llm_service")

SYSTEM_PROMPT = """أنت مساعد صوتي ذكي وودود ومستكشف للعالم. أجب دائماً بلغة كلمات المستخدم نفسها، وليس بلغة واجهة الصفحة أو إعداداتها:
- إذا كانت رسالة المستخدم بالعربية: تحدث بالعامية المصرية الطبيعية، البسيطة، والودية جداً (عامية مصرية أصيلة عادية زي محادثات الناس اليومية، ولا تستخدم اللغة الفصحى إطلاقاً).
- إذا كانت رسالة المستخدم بالإنجليزية: تحدث بالإنجليزية الطبيعية والسلسة والواضحة (Natural, conversational English).
- لا تترجم كلام المستخدم أو تنقله إلى لغة أخرى؛ أجب بلغته نفسها إلا إذا طلب الترجمة صراحةً. إذا كان الكلام مزيجاً من العربية والإنجليزية، أجب باللغة الغالبة فيه.

قواعد هامة جداً للمحادثة الصوتية:
1. إجاباتك موجزة ومباشرة وودية تناسب النطق الصوتي (جملتين إلى ثلاث جمل في المعتاد).
2. لا تستخدم علامات النجمة (*) أو الرموز التعبيرية (الإيموجي) أو جداول الماركداون داخل الإجابة لأن النص يُقرأ صوتياً بواسطة نظام تحويل النص إلى كلام (TTS).
3. عند ذكر درجات الحرارة أو الأرقام، اكتبها دائماً كأرقام صريحة (مثل 36°C أو 25 كم/س) ولا تكتبها ككلمات مفردة (لا تكتب ستة وثلاثين).
4. تحدث بأسلوب بشري جذاب وواقعي يعكس الشخصية المختارة.
5. لا تخمّن ولا تختلق حقائق أو مصادر. إذا لم تكن متأكداً، وضّح ذلك باختصار واطلب توضيحاً عند الحاجة.
6. استخدم البيانات المرفقة فقط عند الإجابة عن الطقس أو الأخبار الحالية، ولا تخترع تفاصيل غير موجودة فيها.
7. كن جاهزاً للمساعدة في أي استفسار عام أو استكشاف على الخريطة. Keep the same selected speaker identity in both languages."""


class LLMService:
    def __init__(self):
        self.api_url = LLM_API_URL
        self.primary_model = LLM_MODEL
        self.fallback_model = LLM_FALLBACK_MODEL
        self.api_key = LLM_API_KEY

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 400,
        on_token: Callable[[str], None] | None = None,
    ) -> str:
        """
        Calls the Groq Cloud chat completions endpoint with automatic fallback.
        When provided, on_token receives each generated text fragment.
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
            fragments: List[str] = []
            response: requests.Response | None = None

            payload = {
                "model": model,
                "messages": formatted_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": on_token is not None,
            }

            try:
                logger.info(f"Sending prompt to Groq Cloud endpoint {self.api_url} (model={model})...")
                response = requests.post(
                    self.api_url,
                    headers=headers,
                    json=payload,
                    timeout=(10, 60),
                    stream=on_token is not None,
                )

                if response.status_code == 200:
                    if on_token is not None:
                        for line in response.iter_lines(decode_unicode=False):
                            if isinstance(line, bytes):
                                try:
                                    line = line.decode("utf-8")
                                except UnicodeDecodeError:
                                    logger.warning(
                                        "Groq model %s returned a non-UTF-8 stream line",
                                        model,
                                    )
                                    continue
                            if not line or not line.startswith("data:"):
                                continue
                            data = line[5:].strip()
                            if data == "[DONE]":
                                break
                            try:
                                chunk = json.loads(data)
                            except json.JSONDecodeError:
                                logger.warning(
                                    "Groq model %s returned an invalid streaming event",
                                    model,
                                )
                                continue
                            choices = chunk.get("choices", [])
                            if not choices:
                                continue
                            content = choices[0].get("delta", {}).get("content")
                            if content:
                                fragments.append(content)
                                on_token(content)
                        reply_content = "".join(fragments).strip()
                        if reply_content:
                            logger.info(f"Groq LLM ({model}) streamed a reply.")
                            return reply_content
                        last_error = f"Groq model {model} returned an empty streamed reply"
                        continue

                    try:
                        data = response.json()
                    except json.JSONDecodeError:
                        logger.warning("Groq model %s returned invalid JSON", model)
                        last_error = "Invalid response format"
                        continue
                    choices = data.get("choices", [])
                    if choices:
                        reply_content = choices[0].get("message", {}).get("content", "").strip()
                        logger.info(f"Groq LLM ({model}) reply received: '{reply_content[:60]}...'")
                        return reply_content

                logger.warning(
                    "Groq model %s returned HTTP status %s",
                    model,
                    response.status_code,
                )
                last_error = f"Status {response.status_code}"

            except Exception as e:
                logger.warning(f"Error calling Groq model {model}: {e}")
                if on_token is not None and fragments:
                    raise RuntimeError("Groq streaming failed after generating part of the response") from e
                last_error = str(e)
            finally:
                if response is not None:
                    response.close()

        logger.error("All configured Groq models failed: %s", last_error)
        raise RuntimeError("The assistant is temporarily unavailable")


llm_service = LLMService()
