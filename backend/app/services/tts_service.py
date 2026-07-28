import uuid
import os
from gtts import gTTS
from ..config import settings


def text_to_speech(text: str, lang: str = "en") -> str:
    """
    Convert text to an MP3 file, saved under AUDIO_OUTPUT_DIR.
    Returns the filename (not full path) so it can be served via a static route.
    """
    filename = f"{uuid.uuid4().hex}.mp3"
    filepath = os.path.join(settings.AUDIO_OUTPUT_DIR, filename)

    tts = gTTS(text=text, lang=lang)
    tts.save(filepath)

    return filename