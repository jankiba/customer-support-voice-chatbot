import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/voicebot")

    # Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-secret-key")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    # Login OTP (2-step verification)
    OTP_EXPIRE_MINUTES: int = 5
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    BREVO_SENDER_EMAIL: str = os.getenv("BREVO_SENDER_EMAIL", "no-reply@example.com")
    BREVO_SENDER_NAME: str = os.getenv("BREVO_SENDER_NAME", "Customer Support Voice Chatbot")

    # Groq (LLM)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Whisper (STT)
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")  # tiny/base/small/medium

    # Embeddings
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # Storage paths
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    FAISS_INDEX_DIR: str = os.getenv("FAISS_INDEX_DIR", "faiss_indexes")
    AUDIO_OUTPUT_DIR: str = os.getenv("AUDIO_OUTPUT_DIR", "audio_output")

    # Chunking
    CHUNK_SIZE: int = 800        # characters per chunk
    CHUNK_OVERLAP: int = 150

    # RAG
    TOP_K_CHUNKS: int = 8

settings = Settings()

# Ensure local directories exist
for d in [settings.UPLOAD_DIR, settings.FAISS_INDEX_DIR, settings.AUDIO_OUTPUT_DIR]:
    os.makedirs(d, exist_ok=True)
