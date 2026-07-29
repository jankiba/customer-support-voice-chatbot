import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendTextMessage, sendVoiceMessage, audioUrl } from "../api";

// --- Voice activity detection tuning ---
const SPEECH_THRESHOLD = 0.02; // raise if background noise triggers it, lower if quiet speech is missed
const SILENCE_MS = 1200;       // pause length that means "user is done talking"
const MIN_SPEECH_MS = 300;     // ignore accidental taps/coughs shorter than this

function getSessionId() {
  let id = sessionStorage.getItem("chat_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("chat_session_id", id);
  }
  return id;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function VoiceOrb({ state, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={state === "listening" ? "Stop voice chat" : "Start voice chat"}
      className="relative w-28 h-28 flex items-center justify-center focus:outline-none group"
    >
      {(state === "listening" || state === "speaking") && (
        <>
          <span
            className={`absolute inset-0 rounded-full border ${state === "listening" ? "border-listen" : "border-voice"
              } animate-ring-pulse-1`}
          />
          <span
            className={`absolute inset-0 rounded-full border ${state === "listening" ? "border-listen" : "border-voice"
              } animate-ring-pulse-2`}
          />
          <span
            className={`absolute inset-0 rounded-full border ${state === "listening" ? "border-listen" : "border-voice"
              } animate-ring-pulse-3`}
          />
        </>
      )}

      <span
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-300
          ${state === "listening" ? "bg-listen shadow-[0_0_40px_-4px_rgba(255,107,107,0.7)]" : ""}
          ${state === "speaking" ? "bg-voice shadow-[0_0_40px_-4px_rgba(79,232,199,0.7)]" : ""}
          ${state === "thinking" ? "bg-ink-700" : ""}
          ${state === "idle" ? "bg-ink-800 group-hover:bg-ink-700 animate-orb-breathe" : ""}
        `}
      >
        {state === "thinking" ? (
          <span className="w-6 h-6 border-2 border-voice border-t-transparent rounded-full animate-spin" />
        ) : state === "speaking" ? (
          <span className="flex items-end gap-1 h-6">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-1 bg-ink-950 rounded-full animate-wave-bar"
                style={{ height: "100%", animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </span>
        ) : (
          <svg
            className={`w-7 h-7 ${state === "listening" ? "text-ink-950" : "text-voice"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 19v3" />
          </svg>
        )}
      </span>
    </button>
  );
}

function EscalationBanner() {
  return (
    <div className="mx-auto flex items-center gap-2 bg-signal/10 border border-signal/30 text-signal text-xs px-3.5 py-2 rounded-full animate-msg-in">
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      A human agent has been notified
    </div>
  );
}

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "gu", label: "ગુજ" },
];

export default function ChatWidget({ companySlug, companyName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [orbState, setOrbState] = useState("idle");
  const [showTextInput, setShowTextInput] = useState(false);
  const [language, setLanguage] = useState("en");

  // --- voice session refs (replaces the old single mediaRecorderRef) ---
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechStartRef = useRef(null);
  const recordingRef = useRef(false);
  const sessionActiveRef = useRef(false);   // whole listen-session on/off (tap orb to toggle)
  const listeningPausedRef = useRef(false); // true while bot is thinking/speaking, so mic ignores it

  const sessionId = useRef(getSessionId());
  const audioRef = useRef(new Audio());
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, orbState]);

  // stop everything and release the mic
  useEffect(() => {
    return () => stopSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlockAudio() {
    const el = audioRef.current;
    el.play().catch(() => { });
    el.pause();
  }

  function playAudio(url) {
    const el = audioRef.current;
    el.src = url;
    el.onended = () => {
      // bot finished speaking — resume auto-listening for the next sentence
      listeningPausedRef.current = false;
      setOrbState(sessionActiveRef.current ? "listening" : "idle");
    };
    el.play().catch(() => {
      listeningPausedRef.current = false;
      setOrbState(sessionActiveRef.current ? "listening" : "idle");
    });
  }

  function appendMessage(role, text, isVoice = false) {
    setMessages((prev) => [...prev, { role, text, isVoice, id: crypto.randomUUID(), time: new Date() }]);
  }

  async function handleBotResponse(promise) {
    setOrbState("thinking");
    try {
      const { data } = await promise;
      appendMessage("bot", data.answer);
      if (data.audio_url) {
        setOrbState("speaking");
        playAudio(audioUrl(data.audio_url));
      } else {
        listeningPausedRef.current = false;
        setOrbState(sessionActiveRef.current ? "listening" : "idle");
      }
      if (data.escalated && data.answer.includes("Ticket ID:")) {
        setMessages((prev) => [...prev, { role: "escalation", id: crypto.randomUUID() }]);
      }
    } catch (err) {
      appendMessage("system", "Something went wrong. Please try again.");
      listeningPausedRef.current = false;
      setOrbState(sessionActiveRef.current ? "listening" : "idle");
    }
  }

  function handleSendText() {
    if (!input.trim()) return;
    unlockAudio();
    appendMessage("user", input);
    const text = input;
    setInput("");
    handleBotResponse(sendTextMessage(companySlug, sessionId.current, text, language));
  }

  // --- Voice activity detection loop ---

  function startRecordingChunk() {
    if (recordingRef.current || !streamRef.current) return;
    recordingRef.current = true;
    speechStartRef.current = Date.now();

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "audio/webm" });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const spokeFor = Date.now() - (speechStartRef.current || 0);
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      recordingRef.current = false;

      if (spokeFor >= MIN_SPEECH_MS && blob.size > 0 && sessionActiveRef.current) {
        listeningPausedRef.current = true; // don't record the bot's own voice back
        appendMessage("user", "Voice message", true);
        handleBotResponse(sendVoiceMessage(companySlug, sessionId.current, blob, language));
      }
    };
    recorder.start();
    recorderRef.current = recorder;
  }

  function scheduleSilenceStop() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (recordingRef.current && recorderRef.current) {
        recorderRef.current.stop();
      }
    }, SILENCE_MS);
  }

  function monitorVolume() {
    if (!sessionActiveRef.current) return; // session ended — stop the loop

    const analyser = analyserRef.current;
    if (!analyser || listeningPausedRef.current) {
      // bot is thinking/speaking right now — don't listen to itself
      rafRef.current = requestAnimationFrame(monitorVolume);
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const norm = (data[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    if (rms > SPEECH_THRESHOLD) {
      if (!recordingRef.current) startRecordingChunk();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else if (recordingRef.current && !silenceTimerRef.current) {
      scheduleSilenceStop();
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  }

  async function startSession() {
    unlockAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      sessionActiveRef.current = true;
      listeningPausedRef.current = false;
      setOrbState("listening");
      rafRef.current = requestAnimationFrame(monitorVolume);
    } catch {
      appendMessage("system", "Microphone access is needed for voice input. You can also type below.");
      setShowTextInput(true);
    }
  }

  function stopSession() {
    sessionActiveRef.current = false;
    listeningPausedRef.current = false;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recordingRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    setOrbState("idle");
  }

  function handleOrbClick() {
    if (orbState === "thinking") return;

    if (sessionActiveRef.current) {
      stopSession();
    } else {
      startSession();
    }
  }

  const orbLabel = {
    idle: "Tap to speak",
    listening: "Listening… just talk, I'll catch it",
    thinking: "Thinking…",
    speaking: "Speaking…",
  }[orbState];

  return (
    <div className="flex flex-col h-[640px] w-full max-w-md rounded-2xl overflow-hidden border border-ink-700 bg-ink-900 shadow-2xl font-body">
      <div className="flex items-center gap-3 px-5 py-4 bg-ink-800 border-b border-ink-700">
        <button
          onClick={() => navigate("/")}
          aria-label="Back to home"
          className="text-mist-400 hover:text-mist-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-voice/15 flex items-center justify-center text-voice font-display font-semibold text-sm">
          {companyName?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-mist-100 text-sm truncate capitalize">{companyName}</p>
          <p className="text-xs text-voice flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-voice inline-block" /> Online
          </p>
        </div>
        <div className="flex bg-ink-900 rounded-lg p-0.5 shrink-0">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLanguage(l.code)}
              className={`px-2 py-1 rounded-md text-xs transition-colors ${language === l.code ? "bg-voice text-ink-950 font-semibold" : "text-mist-400 hover:text-mist-200"
                }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scroll-smooth">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 -mt-4 animate-fade-in">
            <p className="font-display text-mist-100 text-lg mb-1">Hi, I'm your assistant</p>
            <p className="text-mist-400 text-sm">Tap the orb below to ask by voice, or type a message.</p>
          </div>
        )}
        {messages.map((m) =>
          m.role === "escalation" ? (
            <EscalationBanner key={m.id} />
          ) : (
            <div key={m.id} className={`flex flex-col animate-msg-in ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex items-center gap-2 ${m.role === "user"
                  ? "bg-signal text-white rounded-br-sm"
                  : m.role === "system"
                    ? "bg-ink-700 text-mist-200 mx-auto text-xs text-center"
                    : "bg-ink-800 text-mist-100 rounded-bl-sm border border-ink-700"
                  }`}
              >
                {m.isVoice && (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                  </svg>
                )}
                <span>{m.text}</span>
              </div>
              {m.time && m.role !== "system" && (
                <span className="text-[10px] text-mist-400 mt-1 px-1">{formatTime(m.time)}</span>
              )}
            </div>
          )
        )}
        {orbState === "thinking" && (
          <div className="flex items-start animate-msg-in">
            <div className="bg-ink-800 border border-ink-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-mist-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 pb-3 pt-1">
        <VoiceOrb state={orbState} onClick={handleOrbClick} />
        <p className="text-xs text-mist-400">{orbLabel}</p>
      </div>

      <div className="border-t border-ink-700 bg-ink-800 px-4 py-3">
        {showTextInput ? (
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 bg-ink-900 border border-ink-600 rounded-full px-4 py-2 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-voice"
              placeholder="Type a message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            />
            <button
              onClick={handleSendText}
              className="bg-voice text-ink-950 px-4 py-2 rounded-full text-sm font-medium hover:bg-voice-glow transition-colors"
            >
              Send
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTextInput(true)}
            className="w-full text-center text-xs text-mist-400 hover:text-mist-200 transition-colors py-1"
          >
            or type a message instead
          </button>
        )}
      </div>
    </div>
  );
}
