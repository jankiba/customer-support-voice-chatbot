from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import Base, engine
from .config import settings
from .routers import admin, knowledge_base, chatbot, tickets, analytics, public

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Customer Support Voice Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/audio", StaticFiles(directory=settings.AUDIO_OUTPUT_DIR), name="audio")

app.include_router(admin.router)
app.include_router(knowledge_base.router)
app.include_router(chatbot.router)
app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(public.router)

@app.get("/")
def root():
    return {"status": "ok", "service": "Customer Support Voice Chatbot API"}