# 🎙️ Customer Support Voice Chatbot

A full-stack, AI-powered voice and text customer support chatbot platform. Businesses register their company, upload documentation, and instantly get a live support widget — powered by RAG (Retrieval-Augmented Generation), speech-to-text, and text-to-speech — that can answer customer questions in real time.

---

## 📌 Project Purpose

To provide businesses with an intelligent, embeddable customer support assistant that can:

- Answer questions grounded strictly in the company's own uploaded documents.
- Support both voice and text interaction modes.
- Automatically escalate unresolved queries to human agents via support tickets and email notifications.
- Be deployed per-company through a unique company slug URL.

---

## 🚨 Problem Statement

Traditional customer support is slow, expensive, and often unavailable outside business hours. Companies struggle to provide:

- **Instant, accurate answers** to repetitive customer questions.
- **24/7 availability** without a large human support team.
- **Consistent information** grounded in actual policy documents (not hallucinated responses).
- **Smooth escalation** when a query is too complex for automation.

---

## 💡 Solution / Approach

This platform uses a **RAG (Retrieval-Augmented Generation)** pipeline to answer questions strictly from uploaded company documents:

1. **Document ingestion** — Admins upload PDF/text files; the backend chunks them, generates embeddings via `sentence-transformers`, and indexes them in a per-company **FAISS** vector store.
2. **Retrieval** — On each customer query, the top-K most relevant document chunks are retrieved via semantic similarity search.
3. **Generation** — Retrieved chunks are passed as grounded context to **Groq's Llama 3** LLM, which generates a concise, confidence-scored answer.
4. **Voice layer** — Customer speech is transcribed with **Faster-Whisper** (STT) and bot responses are played back using **gTTS** (TTS).
5. **Escalation** — Low-confidence answers or frustration-detected queries trigger an automatic support ticket and email to the company.

---

## ✨ Features

### 👤 Customer-Facing
- **Voice chat** — Talk to the bot using your microphone; responses are spoken back.
- **Text chat** — Type questions and receive instant answers.
- **Voice Activity Detection (VAD)** — Intelligently detects when you start/stop speaking with noise calibration.
- **Multilingual support** — Responds in English, Hindi, or Gujarati based on selection.
- **Time-aware greetings** — Bot greets with "Good morning / afternoon / evening" contextually.
- **Live FAQ suggestions** — Shows the most frequently asked questions while you type.
- **Session memory** — Remembers entities (e.g., order numbers, names) within a conversation.
- **Ticket creation** — If the bot can't help, it offers to create a support ticket with a unique ID.

### 🏢 Admin Dashboard
- **Company registration & login** — Secure two-step login with OTP email verification (via Brevo).
- **Knowledge base management** — Upload, view, and delete PDF/text documents.
- **Team management** — Invite additional team members to access the dashboard.
- **Conversation history** — View all past customer conversations.
- **Support tickets** — Track and manage escalated tickets with status updates.
- **Analytics** — View basic usage analytics.
- **Embeddable widget URL** — Each company gets a unique `/support/<company-slug>` URL.

---

## 🛠️ Technologies Used

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | REST API framework |
| **SQLAlchemy** | ORM for database interaction |
| **PostgreSQL** | Relational database |
| **Groq (Llama 3.3-70B)** | LLM for answer generation |
| **Faster-Whisper** | Speech-to-text transcription |
| **gTTS** | Text-to-speech audio generation |
| **FAISS** | Vector similarity search |
| **sentence-transformers** | Text embedding model (`all-MiniLM-L6-v2`) |
| **PyMuPDF** | PDF document parsing |
| **python-jose / passlib** | JWT authentication & password hashing |
| **Brevo (Sendinblue)** | OTP email delivery |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool and dev server |
| **React Router v6** | Client-side routing |
| **Axios** | HTTP client |
| **Tailwind CSS v3** | Utility-first styling |
| **Web Audio API** | Microphone access & VAD |
| **MediaRecorder API** | Voice recording |

---

## 📦 Dependencies / Requirements

### System Requirements
- **Python** 3.10+
- **Node.js** 18+
- **PostgreSQL** 14+
- A **Groq API key** (free tier available at https://console.groq.com)
- A **Brevo API key** (for OTP emails; free tier available at https://brevo.com)

### Backend Python Packages
```
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
python-dotenv==1.0.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
pydantic[email]==2.9.2
httpx==0.27.2
PyMuPDF==1.24.10
sentence-transformers==3.1.1
faiss-cpu==1.8.0.post1
faster-whisper==1.0.3
groq==0.11.0
gTTS==2.5.3
```

### Frontend npm Packages
```
react ^18.3.1
react-dom ^18.3.1
react-router-dom ^6.26.2
axios ^1.7.7
tailwindcss ^3.4.13
vite ^5.4.6
```

---

## ⚙️ Installation Steps

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "customer support voice chatbot"
```

### 2. Set Up the Database
Ensure PostgreSQL is running, then create a database:
```sql
CREATE DATABASE voicebot;
```

### 3. Configure Backend Environment
```bash
cd backend
cp .env.example .env
```

Edit `.env` and fill in your values:
```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/voicebot
JWT_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=your-groq-api-key-here
GROQ_MODEL=llama-3.3-70b-versatile
WHISPER_MODEL_SIZE=base
EMBEDDING_MODEL=all-MiniLM-L6-v2
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=Customer Support Voice Chatbot
```

### 4. Install Backend Dependencies
```bash
cd backend
python -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

> **Note:** On first run, `sentence-transformers` and `faster-whisper` will automatically download their model files (~100–400 MB each). Ensure you have a working internet connection.

### 5. Configure Frontend Environment
```bash
cd frontend
```

Create a `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

### 6. Install Frontend Dependencies
```bash
cd frontend
npm install
```

---

## ▶️ How to Run / Start the Project

### Start the Backend
```bash
cd backend
source venv/bin/activate      # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

The API will be available at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### Start the Frontend
Open a new terminal:
```bash
cd frontend
npm run dev
```

The frontend will be available at: `http://localhost:5173`

---

## 📁 Project Structure

```
customer support voice chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app entry point & middleware setup
│   │   ├── config.py             # Environment config & settings
│   │   ├── database.py           # SQLAlchemy engine & session
│   │   ├── models.py             # Database models (Company, Document, Conversation, Ticket)
│   │   ├── schemas.py            # Pydantic request/response schemas
│   │   ├── auth.py               # JWT auth helpers
│   │   ├── routers/
│   │   │   ├── admin.py          # Company registration, login (OTP), team management
│   │   │   ├── chatbot.py        # Text & voice chat endpoints, escalation logic
│   │   │   ├── knowledge_base.py # Document upload & management
│   │   │   ├── tickets.py        # Support ticket CRUD
│   │   │   ├── analytics.py      # Usage analytics
│   │   │   └── public.py         # Public company info endpoint
│   │   └── services/
│   │       ├── llm_service.py        # Groq LLM answer generation + confidence scoring
│   │       ├── faiss_service.py      # FAISS vector store (index, search)
│   │       ├── embedding_service.py  # sentence-transformers embeddings
│   │       ├── document_processor.py # PDF parsing & text chunking
│   │       ├── stt_service.py        # Faster-Whisper speech-to-text
│   │       ├── tts_service.py        # gTTS text-to-speech
│   │       ├── email_service.py      # Brevo OTP & escalation emails
│   │       ├── otp_service.py        # OTP generation & verification
│   │       ├── session_state.py      # In-memory session state (entities, ticket flags)
│   │       └── conversation_utils.py # Entity extraction from conversation
│   ├── audio_output/             # Generated TTS audio files (served as static)
│   ├── faiss_indexes/            # Per-company FAISS index files
│   ├── uploads/                  # Temporary file upload storage
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── App.jsx               # Root router (Home, Admin, Support pages)
    │   ├── api.js                # Axios API client (all backend calls)
    │   ├── main.jsx              # React entry point
    │   ├── index.css             # Global CSS reset
    │   └── components/
    │       ├── ChatWidget.jsx    # Full voice/text chat UI with VAD
    │       ├── AdminDashboard.jsx# Admin panel (docs, tickets, team, analytics)
    │       ├── home.jsx          # Landing page (company lookup)
    │       ├── skeleton.jsx      # Loading skeleton components
    │       └── toast.jsx         # Toast notification system
    ├── tailwind.config.js        # Custom design tokens (colors, fonts, animations)
    ├── vite.config.js
    └── package.json
```

---

## 🔮 Future Improvements

- **Multi-language document ingestion** — Currently supports English; extend to auto-detect and index multilingual documents.
- **WebSocket streaming** — Stream LLM responses token-by-token for a real-time typing effect.
- **Embeddable JS widget** — Provide a `<script>` tag businesses can drop into any existing website.
- **Analytics dashboard** — Rich charts for conversation volume, escalation rate, top questions over time.
- **Feedback loop** — Allow customers to thumbs-up/down bot answers to improve retrieval quality over time.
- **Redis session store** — Replace in-memory session state with Redis for multi-worker/production deployments.
- **Docker Compose setup** — Containerise the full stack for one-command deployment.
- **Support for more file types** — Extend beyond PDFs to Word documents, HTML pages, and web scraping.
- **Human handoff integration** — Live chat handoff to a human agent (e.g., via Intercom or Crisp) when escalating.

---

## 👩‍💻 Author Details

**Jankiba Mangrola**  
AI/ML intern

> Built as a complete voice-first AI customer support platform combining RAG, real-time speech processing, and a modern React frontend with a FastAPI/PostgreSQL backend.
