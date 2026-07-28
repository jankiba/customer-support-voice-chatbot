import re
import fitz  # PyMuPDF
from ..config import settings


def extract_text_from_pdf(file_path: str) -> str:
    """Extract raw text from a PDF file."""
    text_parts = []
    with fitz.open(file_path) as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def chunk_text(text: str, chunk_size: int = None, overlap: int = None) -> list[str]:
    """
    Split text into chunks of ~chunk_size characters, breaking on sentence
    boundaries rather than mid-sentence.
    """
    chunk_size = chunk_size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP

    text = " ".join(text.split())
    if not text:
        return []

    sentences = _SENTENCE_SPLIT.split(text)

    chunks = []
    current = []
    current_len = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        if current_len + len(sentence) + 1 > chunk_size and current:
            chunks.append(" ".join(current))
            overlap_sentences = []
            overlap_len = 0
            for s in reversed(current):
                if overlap_len + len(s) > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_len += len(s) + 1
            current = overlap_sentences
            current_len = overlap_len

        current.append(sentence)
        current_len += len(sentence) + 1

    if current:
        chunks.append(" ".join(current))

    return [c for c in chunks if c]


def process_document(file_path: str) -> list[str]:
    """Full pipeline: PDF -> raw text -> chunks."""
    raw_text = extract_text_from_pdf(file_path)
    return chunk_text(raw_text)