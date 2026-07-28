from sentence_transformers import SentenceTransformer
from ..config import settings

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
    return _model


def embed_texts(texts: list[str]):
    """Convert a list of strings into a numpy array of embeddings."""
    model = get_model()
    return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


def embed_text(text: str):
    """Convert a single string into an embedding vector."""
    return embed_texts([text])[0]