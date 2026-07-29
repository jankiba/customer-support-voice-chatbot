import json
from groq import Groq
from ..config import settings

_client = None


def get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "gu": "Gujarati"}

SYSTEM_PROMPT = """You are a knowledgeable support assistant for {company_name}.
Answer the person's question using ONLY the context below. The context may come
from multiple document chunks — read all of them and synthesize a single clear
answer; don't just repeat the first chunk if a later one is more relevant.

{tone_instruction}

Known details from earlier in this conversation (reuse these if relevant —
don't ask the customer to repeat information you already have):
{known_entities}

Respond in {language_name}, regardless of what language the context is written in.

Rules:
- If the context fully or partially answers the question, answer directly and
  specifically (include numbers, timeframes, and conditions exactly as given).
- If the context does not contain the answer, do not guess or invent policy
  details.
- Never blend outside knowledge with the context. Only use what's provided.
- Keep answers concise (2-4 sentences) and conversational, since this may be
  read aloud.

You MUST respond with ONLY a valid JSON object in exactly this shape, nothing else:
{{"answer": "your answer text here", "confidence": <integer 0-100>}}

Confidence guide:
- 90-100: the context directly and clearly answers the question
- 50-89: the context partially answers it or requires some inference
- 0-49: the context does not contain the answer at all

Context:
{context}
"""

ESCALATION_KEYWORDS = [
    "charged twice", "double charged", "refund not received", "fraud",
    "unauthorized", "legal", "lawsuit", "complaint", "angry", "scam",
    "hacked", "speak to a human", "speak to a person", "manager",
]

FRUSTRATION_KEYWORDS = [
    "frustrated", "furious", "angry", "annoyed", "unacceptable", "ridiculous",
    "terrible", "worst", "hate this", "fed up", "sick of", "pathetic", "awful",
    "disappointed", "useless",
]

# Baseline personality applied to every response, regardless of mood.
BASE_TONE = (
    "Speak like a warm, friendly human support agent — casual and upbeat, "
    "not robotic or overly formal. Use natural phrasing like \"Sure thing!\", "
    "\"Got it!\", or \"No worries!\" where it fits naturally."
)


def needs_escalation(question: str, retrieved_chunks: list[str]) -> bool:
    """Cheap pre-check before even calling the LLM."""
    q_lower = question.lower()
    if any(kw in q_lower for kw in ESCALATION_KEYWORDS):
        return True
    if not retrieved_chunks:
        return True
    return False


def detect_frustration(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in FRUSTRATION_KEYWORDS)


def generate_answer(
    company_name: str,
    question: str,
    context_chunks: list[str],
    history: list[dict] = None,
    language: str = "en",
    known_entities: dict = None,
    frustrated: bool = False,
) -> tuple[str, int]:
    """
    Generate a grounded answer using Groq's Llama 3 model, along with the
    model's own confidence in that answer (0-100).

    Returns (answer_text, confidence).
    """
    context = "\n".join(f"- {c}" for c in context_chunks) if context_chunks else "No relevant documents found."
    language_name = LANGUAGE_NAMES.get(language, "English")

    tone_instruction = (
        BASE_TONE + " The customer seems frustrated or upset — briefly acknowledge "
        "that with empathy before addressing their question, and keep things calm "
        "rather than overly cheerful."
        if frustrated
        else BASE_TONE
    )

    entities_str = ", ".join(f"{k}: {v}" for k, v in (known_entities or {}).items()) or "None yet."

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(
                company_name=company_name,
                context=context,
                language_name=language_name,
                tone_instruction=tone_instruction,
                known_entities=entities_str,
            ),
        }
    ]
    if history:
        messages.extend(history[-6:])
    messages.append({"role": "user", "content": question})

    client = get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=400,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()

    try:
        parsed = json.loads(raw)
        answer = str(parsed.get("answer", "")).strip()
        confidence = int(parsed.get("confidence", 50))
        confidence = max(0, min(100, confidence))
        if not answer:
            raise ValueError("empty answer field")
    except Exception:
        answer = raw
        confidence = 50

    if 50 <= confidence < 80:
        answer = f"Based on the available information: {answer}"

    return answer, confidence