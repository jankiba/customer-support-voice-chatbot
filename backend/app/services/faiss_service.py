import os
import json
import faiss
import numpy as np

from ..config import settings
from .embedding_service import embed_texts, embed_text


def _index_path(company_id: int) -> str:
    return os.path.join(settings.FAISS_INDEX_DIR, f"company_{company_id}.index")


def _meta_path(company_id: int) -> str:
    return os.path.join(settings.FAISS_INDEX_DIR, f"company_{company_id}_meta.json")


def _load_meta(company_id: int) -> list[str]:
    path = _meta_path(company_id)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def _save_meta(company_id: int, meta: list[str]):
    with open(_meta_path(company_id), "w", encoding="utf-8") as f:
        json.dump(meta, f)


def _load_or_create_index(company_id: int, dim: int) -> faiss.Index:
    path = _index_path(company_id)
    if os.path.exists(path):
        return faiss.read_index(path)
    return faiss.IndexFlatL2(dim)


def add_chunks(company_id: int, chunks: list[str]):
    """Embed chunks and add them to this company's FAISS index."""
    if not chunks:
        return

    vectors = embed_texts(chunks).astype("float32")
    index = _load_or_create_index(company_id, vectors.shape[1])
    index.add(vectors)
    faiss.write_index(index, _index_path(company_id))

    meta = _load_meta(company_id)
    meta.extend(chunks)
    _save_meta(company_id, meta)

def reset_index(company_id: int):
    """Wipe this company's FAISS index and metadata entirely.
    Used before rebuilding from a subset of documents (e.g. after a delete)."""
    for path in (_index_path(company_id), _meta_path(company_id)):
        if os.path.exists(path):
            os.remove(path) 

def search(company_id: int, query: str, top_k: int = None) -> list[str]:
    """Return the top_k most relevant chunks for this company's knowledge base."""
    top_k = top_k or settings.TOP_K_CHUNKS
    path = _index_path(company_id)
    if not os.path.exists(path):
        return []

    index = faiss.read_index(path)
    meta = _load_meta(company_id)
    if index.ntotal == 0 or not meta:
        return []

    query_vector = embed_text(query).astype("float32").reshape(1, -1)
    k = min(top_k, index.ntotal)
    distances, indices = index.search(query_vector, k)

    results = []
    for idx in indices[0]:
        if 0 <= idx < len(meta):
            results.append(meta[idx])
    return results