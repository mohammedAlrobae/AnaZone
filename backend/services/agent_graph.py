import re
import logging
from typing import TypedDict, Optional, List, Dict, Any, Literal
import requests
from langgraph.graph import StateGraph, START, END

from backend.config import NEWS_API_KEY, DEFAULT_VOICE
from backend.services.llm_service import llm_service

logger = logging.getLogger("agent_graph")

# Mapping of country names (English and Arabic) to ISO 2-letter codes for NewsData.io
COUNTRY_CODE_MAP = {
    "jordan": "jo", "الأردن": "jo", "الاردن": "jo",
    "egypt": "eg", "مصر": "eg",
    "saudi arabia": "sa", "السعودية": "sa", "المملكة العربية السعودية": "sa",
    "united arab emirates": "ae", "الإمارات": "ae", "الامارات": "ae",
    "iraq": "iq", "العراق": "iq",
    "lebanon": "lb", "لبنان": "lb",
    "syria": "sy", "سوريا": "sy",
    "palestine": "ps", "فلسطين": "ps",
    "kuwait": "kw", "الكويت": "kw",
    "qatar": "qa", "قطر": "qa",
    "morocco": "ma", "المغرب": "ma",
    "tunisia": "tn", "تونس": "tn",
    "algeria": "dz", "الجزائر": "dz",
    "united states": "us", "أمريكا": "us", "امريكا": "us", "usa": "us",
    "united kingdom": "gb", "بريطانيا": "gb", "uk": "gb",
    "france": "fr", "فرنسا": "fr",
    "germany": "de", "ألمانيا": "de", "المانيا": "de",
    "italy": "it", "إيطاليا": "it", "ايطاليا": "it",
    "spain": "es", "إسبانيا": "es", "اسبانيا": "es",
    "turkey": "tr", "تركيا": "tr",
    "japan": "jp", "اليابان": "jp",
    "china": "cn", "الصين": "cn",
    "canada": "ca", "كندا": "ca",
}

# WMO Weather code interpretations
WEATHER_CODE_DESCRIPTIONS = {
    0: {"en": "Clear sky", "ar": "سماء صافية ومشرقة"},
    1: {"en": "Mainly clear", "ar": "صحو إلى قليل الغيوم"},
    2: {"en": "Partly cloudy", "ar": "غائم جزئياً"},
    3: {"en": "Overcast", "ar": "غائم كلياً"},
    45: {"en": "Foggy", "ar": "ضبابي"},
    48: {"en": "Depositing rime fog", "ar": "ضباب كثيف"},
    51: {"en": "Light drizzle", "ar": "رذاذ مطر خفيف"},
    53: {"en": "Moderate drizzle", "ar": "رذاذ معتدل"},
    55: {"en": "Dense drizzle", "ar": "رذاذ غزير"},
    61: {"en": "Slight rain", "ar": "أمطار خفيفة"},
    63: {"en": "Moderate rain", "ar": "أمطار معتدلة"},
    65: {"en": "Heavy rain", "ar": "أمطار غزيرة"},
    71: {"en": "Slight snow fall", "ar": "تساقط ثلوج خفيف"},
    73: {"en": "Moderate snow fall", "ar": "تساقط ثلوج معتدل"},
    75: {"en": "Heavy snow fall", "ar": "عاصفة ثلجية كثيفة"},
    80: {"en": "Slight rain showers", "ar": "زخات مطر خفيفة"},
    81: {"en": "Moderate rain showers", "ar": "زخات مطر معتدلة"},
    82: {"en": "Violent rain showers", "ar": "زخات مطر قوية"},
    95: {"en": "Thunderstorm", "ar": "عواصف رعدية"},
    96: {"en": "Thunderstorm with slight hail", "ar": "عاصفة رعدية مع حبات برد خفيفة"},
    99: {"en": "Thunderstorm with heavy hail", "ar": "عاصفة رعدية شديدة مع برد"},
}


class AgentState(TypedDict, total=False):
    """LangGraph State representation for the AI Agent."""
    user_message: str
    history: List[Dict[str, str]]
    location_name: Optional[str]
    country: Optional[str]
    city: Optional[str]
    lat: Optional[float]
    lng: Optional[float]
    voice: Optional[str]
    language: str
    intent: Literal["weather", "news", "general"]
    weather_data: Optional[Dict[str, Any]]
    news_data: Optional[List[Dict[str, Any]]]
    is_place_specific: Optional[bool]
    news_place_target: Optional[str]
    reply_text: str


def fetch_open_meteo_weather(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Fetch live weather from Open-Meteo API using latitude and longitude without API keys."""
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            "timezone": "auto",
        }
        res = requests.get(url, params=params, timeout=7)
        if res.status_code == 200:
            data = res.json()
            curr = data.get("current", {})
            w_code = curr.get("weather_code", 0)
            desc = WEATHER_CODE_DESCRIPTIONS.get(w_code, {"en": "Normal weather", "ar": "طقس معتدل"})
            return {
                "temperature": curr.get("temperature_2m"),
                "apparent_temperature": curr.get("apparent_temperature"),
                "humidity": curr.get("relative_humidity_2m"),
                "wind_speed": curr.get("wind_speed_10m"),
                "condition_en": desc["en"],
                "condition_ar": desc["ar"],
                "weather_code": w_code,
            }
    except Exception as e:
        logger.warning(f"Open-Meteo fetch error: {e}")
    return None


def _parse_articles(results: list) -> List[Dict[str, Any]]:
    articles = []
    for item in results[:4]:
        title = item.get("title")
        desc = item.get("description")
        source = item.get("source_name") or item.get("source_id") or "News"
        if title:
            articles.append({
                "title": title,
                "description": desc or "",
                "source": source,
                "link": item.get("link", ""),
                "pubDate": item.get("pubDate", "")
            })
    return articles


def fetch_newsdata_news(
    location_name: Optional[str],
    country: Optional[str],
    city: Optional[str] = None,
    user_message: Optional[str] = None,
    language: str = "ar"
) -> tuple[List[Dict[str, Any]], str, bool]:
    """
    Fetch up-to-date live news for the specific place selected by the user.
    Priority 1: Search specifically for the city/place name selected by user (e.g. 'السلط' or 'Al Salt').
    Priority 2: Check if user explicitly mentioned a target city/country in user_message.
    Priority 3: If no direct city articles found, fallback to the country/region news.
    Returns: (articles, target_name, is_place_specific)
    """
    if not NEWS_API_KEY:
        logger.warning("NEWSAPIKEY is missing in .env")
        return [], "", False

    # 1. Primary Priority: Specific place explicitly selected by the user on the globe
    specific_place = None
    if city and city.strip():
        specific_place = city.strip()
    elif location_name:
        first_segment = location_name.split(",")[0].strip()
        # Exclude raw coordinate strings like "32.03°, 35.73°"
        if "°" not in first_segment and not re.search(r"^[\s\-\d\.]+$", first_segment):
            specific_place = first_segment

    # 2. Secondary: If no place selected, or message specifies a distinct target (e.g. 'في دبي')
    if not specific_place and user_message:
        m_ar = re.search(r"(?:في|عن|بـ|ب)\s+([^\s\?\.،!؟]+)", user_message)
        m_en = re.search(r"(?:in|about|from)\s+([a-zA-Z]+)", user_message, re.IGNORECASE)
        stop_words = {"هنا", "اليوم", "الآن", "الان", "الموقع", "هذا", "هذه", "البلد", "العالم", "المستجدات", "الأخبار", "الاخبار", "here", "today", "now", "this", "world"}
        if m_ar:
            cand = m_ar.group(1).strip("؟?.،!:, ")
            if cand.lower() not in stop_words and len(cand) > 2:
                specific_place = cand
        elif m_en:
            cand = m_en.group(1).strip("?.!,: ")
            if cand.lower() not in stop_words and len(cand) > 2:
                specific_place = cand

    # Resolve country code if known
    country_code = None
    if country:
        country_code = COUNTRY_CODE_MAP.get(country.lower().strip())
    if not country_code and location_name:
        for c_name, code in COUNTRY_CODE_MAP.items():
            if c_name in location_name.lower():
                country_code = code
                break

    url = "https://newsdata.io/api/1/latest"

    # Step 1: Specific Place Priority Search
    if specific_place:
        try:
            params: Dict[str, Any] = {"apikey": NEWS_API_KEY, "q": specific_place}
            if country_code:
                params["country"] = country_code

            res = requests.get(url, params=params, timeout=8)
            if res.status_code == 200:
                results = res.json().get("results", [])
                articles = _parse_articles(results)
                if articles:
                    logger.info(f"NewsData: Found {len(articles)} place-specific news articles for '{specific_place}'")
                    return articles, specific_place, True

            # If country filter was too narrow, search place name globally
            if country_code:
                res_global = requests.get(url, params={"apikey": NEWS_API_KEY, "q": specific_place}, timeout=8)
                if res_global.status_code == 200:
                    results_g = res_global.json().get("results", [])
                    articles_g = _parse_articles(results_g)
                    if articles_g:
                        logger.info(f"NewsData: Found {len(articles_g)} global news articles for '{specific_place}'")
                        return articles_g, specific_place, True
        except Exception as e:
            logger.warning(f"Error querying place news for '{specific_place}': {e}")

    # Step 2: Fallback to broader country news
    if country_code or country:
        try:
            params = {"apikey": NEWS_API_KEY}
            if country_code:
                params["country"] = country_code
            else:
                params["q"] = country

            res = requests.get(url, params=params, timeout=8)
            if res.status_code == 200:
                results = res.json().get("results", [])
                articles = _parse_articles(results)
                if articles:
                    label = country or location_name or "المنطقة"
                    logger.info(f"NewsData: Found {len(articles)} country-level fallback news articles for '{label}'")
                    return articles, label, False
        except Exception as e:
            logger.warning(f"Error querying country fallback news: {e}")

    return [], location_name or "هذا الموقع", False


# -------------------------------------------------------------
# LangGraph Nodes
# -------------------------------------------------------------

def router_node(state: AgentState) -> Dict[str, Any]:
    """
    State Node: Router
    Evaluates user message to route cleanly to weather, news, or general info node.
    """
    msg = (state.get("user_message") or "").lower()

    # Weather intent indicators
    weather_keywords = [
        "طقس", "الطقس", "جو", "الجو", "حرارة", "الحرارة", "درجة الحرارة",
        "مطر", "امطار", "أمطار", "رياح", "رطوبة", "weather", "temperature",
        "forecast", "rain", "climate", "humid", "wind", "degrees"
    ]

    # News intent indicators
    news_keywords = [
        "أخبار", "اخبار", "خبر", "الأخبار", "الاخبار", "مستجدات",
        "احداث", "أحداث", "ماذا يحدث", "شو صار", "إيه الأخبار", "ايه الاخبار",
        "news", "headline", "headlines", "latest news", "events", "updates"
    ]

    intent: Literal["weather", "news", "general"] = "general"
    if any(k in msg for k in weather_keywords):
        intent = "weather"
    elif any(k in msg for k in news_keywords):
        intent = "news"

    logger.info(f"LangGraph Router classified intent='{intent}' for query: '{msg[:50]}'")
    return {"intent": intent}


def weather_node(state: AgentState) -> Dict[str, Any]:
    """
    State Node: Weather (Open-Meteo)
    Fetches live weather from Open-Meteo and formulates a helpful response.
    """
    lat = state.get("lat")
    lng = state.get("lng")
    loc_name = state.get("location_name") or "هذا الموقع"
    is_ar = state.get("language") != "en"

    # Default coordinates fallback if somehow unprovided
    if lat is None or lng is None:
        lat, lng = 32.03, 35.73

    weather = fetch_open_meteo_weather(lat, lng)

    if not weather:
        fallback_msg = (
            f"عذراً، لم أتمكن من جلب بيانات الطقس اللحظية لـ {loc_name} في هذه اللحظة. هل تحب أن أخبرك بمعلومات عامة عنها؟"
            if is_ar
            else f"I'm sorry, I couldn't retrieve the live weather data for {loc_name} at this moment. Would you like to explore its landmarks or general history instead?"
        )
        return {"weather_data": None, "reply_text": fallback_msg}

    # Format human-friendly weather prompt for persona
    if is_ar:
        condition = weather["condition_ar"]
        prompt = (
            f"أنت مساعد جغرافي ذكي ومرح. "
            f"طلب المستخدم معرفة حالة الطقس في {loc_name}.\n"
            f"البيانات الحية المأخوذة الآن من محطة الرصد:\n"
            f"- درجة الحرارة: {weather['temperature']}° مئوية\n"
            f"- الإحساس الفعلي: {weather['apparent_temperature']}° مئوية\n"
            f"- حالة السماء: {condition}\n"
            f"- الرطوبة: {weather['humidity']}%\n"
            f"- سرعة الرياح: {weather['wind_speed']} كم/ساعة\n\n"
            f"المطلوب: أجب المستخدم في جملتين لطيفتين جداً باللهجة المناسبة بأسلوب ودي واختم بسؤال خفيف. "
            f"مهم جداً: اكتب الأرقام دائماً كأرقام (مثل 36 درجة) ولا تكتبها بالحروف أبداً (لا تكتب ستة وتلاتين). "
            f"ملاحظة: لا تضع أي إيموجي أو نجوم أو جداول لأن الكلام سيُنطق صوتياً."
        )
    else:
        condition = weather["condition_en"]
        prompt = (
            f"You are a friendly AI world companion. The user asked for the weather in {loc_name}.\n"
            f"Live weather data:\n"
            f"- Temperature: {weather['temperature']}°C\n"
            f"- Feels like: {weather['apparent_temperature']}°C\n"
            f"- Condition: {condition}\n"
            f"- Humidity: {weather['humidity']}%\n"
            f"- Wind Speed: {weather['wind_speed']} km/h\n\n"
            f"Formulate a warm, natural 2-sentence reply describing the current weather and asking a friendly follow-up. "
            f"Important: Always write temperatures and numbers as digits (e.g. 36°C, 25%), never spell them out as words. "
            f"Do not use emojis, asterisks (*), or tables as this will be read aloud by TTS."
        )

    reply = llm_service.chat_completion([{"role": "user", "content": prompt}], max_tokens=180)
    return {"weather_data": weather, "reply_text": reply}


def news_node(state: AgentState) -> Dict[str, Any]:
    """
    State Node: News (NewsData.io)
    Fetches up-to-date news prioritizing the specific place selected by user.
    """
    loc_name = state.get("location_name") or state.get("city") or "المنطقة"
    country = state.get("country")
    city = state.get("city")
    is_ar = state.get("language") != "en"

    articles, target_label, is_place_specific = fetch_newsdata_news(
        location_name=loc_name,
        country=country,
        city=city,
        user_message=state.get("user_message"),
        language="ar" if is_ar else "en"
    )

    if not articles:
        fallback_msg = (
            f"بحثت لك في منصة الأخبار اللحظية، ولكن لا توجد عناوين إخبارية حديثة متاحة حالياً لـ {loc_name}. هل تود معرفة تفاصيل تاريخية أو معالم سياحية عنها؟"
            if is_ar
            else f"I searched the latest news feeds, but there are no current breaking news headlines for {loc_name} at this moment. Would you like to hear about its unique attractions or history instead?"
        )
        return {"news_data": [], "reply_text": fallback_msg}

    # Format news summary with LLM
    headlines_text = "\n".join([f"- {a['title']} (المصدر: {a['source']})" for a in articles[:3]])

    if is_place_specific:
        if is_ar:
            prompt = (
                f"أنت مساعد إخباري ومستكشف جغرافي ذكي.\n"
                f"طلب المستخدم معرفة أحدث الأخبار الخاصة تحديداً بمدينة/منطقة: {target_label} ({country or ''}).\n"
                f"إليك أحدث العناوين الحقيقية الخاصة بهذا المكان:\n{headlines_text}\n\n"
                f"المطلوب: قدّم للمستخدم إيجازاً إخبارياً شيقاً ومحترماً (في جملتين أو 3 جمل كحد أقصى) يركز تحديداً على ما يحدث في {target_label}. "
                f"ملاحظة: لا تضع أي رموز تعبيرية (إيموجي) أو نجوم (*) أو جداول لأن الكلام سيُنطق صوتياً."
            )
        else:
            prompt = (
                f"You are a friendly AI news guide.\n"
                f"The user requested the latest news specifically for: {target_label} ({country or ''}).\n"
                f"Here are the latest verified headlines related to this place:\n{headlines_text}\n\n"
                f"Summarize what is happening in {target_label} in 2-3 engaging, clear sentences. "
                f"Do not use emojis, asterisks (*), or tables as this will be read aloud by TTS."
            )
    else:
        # Fallback to general country news
        if is_ar:
            prompt = (
                f"أنت مساعد إخباري ومستكشف جغرافي ذكي.\n"
                f"المستخدم يستكشف موقع: {loc_name}. لم يتم العثور على عناوين إخبارية محلية مباشرة مخصصة لهذا الموقع الصغير اليوم، ولكن إليك أبرز العناوين الحالية في {target_label}:\n{headlines_text}\n\n"
                f"المطلوب: وضّح للمستخدم بلطف في البداية أنه لا توجد أحداث محلية عاجلة مسجلة اليوم لـ {loc_name} تحديداً، ولذلك إليك أهم الأخبار العامة في {target_label}، ولخصها في جملتين. "
                f"ملاحظة: لا تضع أي رموز تعبيرية (إيموجي) أو نجوم (*) أو جداول لأن الكلام سيُنطق صوتياً."
            )
        else:
            prompt = (
                f"You are a friendly AI news guide.\n"
                f"The user is exploring {loc_name}. No breaking local headlines were found specifically for this exact spot today, but here are the top current news headlines for {target_label}:\n{headlines_text}\n\n"
                f"Politely note that there are no specific local breaking stories for {loc_name} today, then summarize the latest headlines for {target_label} in 2 clear sentences. "
                f"Do not use emojis, asterisks (*), or tables as this will be read aloud by TTS."
            )

    reply = llm_service.chat_completion([{"role": "user", "content": prompt}], max_tokens=220)
    return {
        "news_data": articles,
        "reply_text": reply,
        "is_place_specific": is_place_specific,
        "news_place_target": target_label
    }


def general_info_node(state: AgentState) -> Dict[str, Any]:
    """
    State Node: General Information
    Answers user queries about the place, history, landmarks, or answers general chat.
    If the agent does not have verified info, it politely and honestly informs the user.
    """
    loc_name = state.get("location_name")
    country = state.get("country")
    user_msg = state.get("user_message") or ""
    history = state.get("history") or []
    is_ar = state.get("language") != "en"

    # Contextual prompt
    system_instruction = (
        f"You are a knowledgeable, friendly world explorer and AI companion.\n"
        f"The user is exploring: {loc_name or 'the world globe'} (Country: {country or 'N/A'}).\n"
        f"Important Guidelines:\n"
        f"1. Be helpful, concise (2-3 sentences), and culturally respectful.\n"
        f"2. If the user asks something you do not know or that cannot be verified about this location, "
        f"honestly and politely tell them you do not have that specific information rather than guessing.\n"
        f"3. Speak naturally in {'friendly Egyptian Arabic' if is_ar else 'warm English'}.\n"
        f"4. Do not use emojis, asterisks (*), or tables as this will be read aloud by TTS."
    )

    messages = [{"role": "system", "content": system_instruction}]
    for m in history[-6:]:
        messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})
    messages.append({"role": "user", "content": user_msg})

    reply = llm_service.chat_completion(messages, max_tokens=250)
    return {"reply_text": reply}


# -------------------------------------------------------------
# LangGraph Workflow Construction
# -------------------------------------------------------------

def route_intent(state: AgentState) -> str:
    """Conditional routing selector based on intent."""
    intent = state.get("intent", "general")
    if intent == "weather":
        return "weather_node"
    elif intent == "news":
        return "news_node"
    return "general_info_node"


def build_agent_graph():
    """Builds and compiles the LangGraph StateGraph workflow."""
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("router", router_node)
    workflow.add_node("weather_node", weather_node)
    workflow.add_node("news_node", news_node)
    workflow.add_node("general_info_node", general_info_node)

    # Set Entry Point
    workflow.add_edge(START, "router")

    # Conditional Routing
    workflow.add_conditional_edges(
        "router",
        route_intent,
        {
            "weather_node": "weather_node",
            "news_node": "news_node",
            "general_info_node": "general_info_node",
        }
    )

    # End Edges
    workflow.add_edge("weather_node", END)
    workflow.add_edge("news_node", END)
    workflow.add_edge("general_info_node", END)

    return workflow.compile()


# Singleton compiled graph instance ready for fast inference
agent_graph = build_agent_graph()
