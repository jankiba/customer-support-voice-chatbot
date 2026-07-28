from faster_whisper import WhisperModel
from ..config import settings

_model = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    return _model


def transcribe_audio(file_path: str) -> str:
    """Transcribe an audio file (webm/mp3/wav) to text."""
    model = get_model()
    segments, _info = model.transcribe(file_path, beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()