import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { sendTextMessage, sendVoiceMessage, audioUrl } from "../api";

// --- Voice activity detection tuning ---
const BASE_SPEECH_THRESHOLD = 0.02;  // fallback if calibration fails
const NOISE_MARGIN = 0.018;          // how much louder than room noise counts as "speech"
const CALIBRATION_MS = 700;          // how long to sample the room before listening for real
const SPEECH_CONFIRM_FRAMES = 4;     // consecutive loud frames needed before we commit to recording (~65ms each)
const SILENCE_MS = 1200;             // pause length that means "user is done talking"
const MIN_SPEECH_MS = 300;           // ignore accidental taps/coughs shorter than this

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

// Client-side version of the time-based greeting, used for the welcome
// bubble shown the instant the chat opens (before any backend round-trip).
function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "good morning";
  if (hour < 17) return "good afternoon";
  return "good evening";
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
  const [micBlocked, setMicBlocked] = useState(false); // true if auto-start couldn't get mic permission

  // --- voice session refs ---
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const speechStartRef = useRef(null);
  const recordingRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const listeningPausedRef = useRef(false);
  const speechThresholdRef = useRef(BASE_SPEECH_THRESHOLD); // set after calibration
  const loudFrameStreakRef = useRef(0); // consecutive frames above threshold

  const sessionId = useRef(getSessionId());
  const audioRef = useRef(new Audio());
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, orbState]);

  const hasInitializedRef = useRef(false);

  // --- Welcome message + auto-start mic, the moment this company's chat opens ---
  useEffect(() => {
    if (hasInitializedRef.current) return; // guards against React dev-mode double-invoke
    hasInitializedRef.current = true;

    if (companyName) {
      appendMessage(
        "bot",
        `Hello, ${timeGreeting()}! I'm ${companyName}'s assistant. How can I help you today?`
      );
    }
    // Auto-start listening right away — no tap needed. If the browser blocks
    // mic access (no permission yet, or user declines), we fall back to
    // showing the manual "tap to speak" state instead of crashing.
    startSession();

    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName]);

  function unlockAudio() {
    const el = audioRef.current;
    el.play().catch(() => { });
    el.pause();
  }

  function playAudio(url) {
    const el = audioRef.current;
    el.src = url;
    el.onended = () => {
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
        listeningPausedRef.current = true;
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
    if (!sessionActiveRef.current) return;

    const analyser = analyserRef.current;
    if (!analyser || listeningPausedRef.current) {
      loudFrameStreakRef.current = 0;
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
    const threshold = speechThresholdRef.current;

    if (rms > threshold) {
      loudFrameStreakRef.current += 1;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      // Only commit to recording after several consecutive loud frames —
      // a single spike (click, cough, static) won't trigger it, only
      // genuinely sustained speech will.
      if (!recordingRef.current && loudFrameStreakRef.current >= SPEECH_CONFIRM_FRAMES) {
        startRecordingChunk();
      }
    } else {
      loudFrameStreakRef.current = 0;
      if (recordingRef.current && !silenceTimerRef.current) {
        scheduleSilenceStop();
      }
    }

    rafRef.current = requestAnimationFrame(monitorVolume);
  }

  // Sample the room's baseline noise level for a moment before we start
  // actually listening for speech, so a noisy room doesn't cause constant
  // false triggers. Sets speechThresholdRef to (room noise + margin).
  function calibrateNoiseFloor(analyser) {
    return new Promise((resolve) => {
      const samples = [];
      const data = new Uint8Array(analyser.fftSize);
      const start = Date.now();

      function sample() {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const norm = (data[i] - 128) / 128;
          sumSquares += norm * norm;
        }
        samples.push(Math.sqrt(sumSquares / data.length));

        if (Date.now() - start < CALIBRATION_MS) {
          requestAnimationFrame(sample);
        } else {
          const avgNoise = samples.reduce((a, b) => a + b, 0) / samples.length;
          resolve(Math.max(BASE_SPEECH_THRESHOLD, avgNoise + NOISE_MARGIN));
        }
      }
      sample();
    });
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
      listeningPausedRef.current = true; // stay paused during calibration
      setMicBlocked(false);
      setOrbState("idle"); // brief "calibrating" moment reads as idle, not listening yet

      const threshold = await calibrateNoiseFloor(analyser);
      speechThresholdRef.current = threshold;
      loudFrameStreakRef.current = 0;
      listeningPausedRef.current = false;

      if (!sessionActiveRef.current) return; // session was stopped mid-calibration

      setOrbState("listening");
      rafRef.current = requestAnimationFrame(monitorVolume);
    } catch {
      // Mic permission wasn't granted automatically (common on first visit,
      // or if the browser requires an explicit user gesture). Fall back to
      // the manual "tap to speak" flow instead of failing silently.
      setMicBlocked(true);
      setOrbState("idle");
    }
  }

  function stopSession() {
    sessionActiveRef.current = false;
    listeningPausedRef.current = false;
    loudFrameStreakRef.current = 0;

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

  const orbLabel = micBlocked
    ? "Tap to enable microphone"
    : {
      idle: sessionActiveRef.current ? "Calibrating…" : "Tap to speak",
      listening: "Listening… just talk, I'll catch it",
      thinking: "Thinking…",
      speaking: "Speaking…",
    }[orbState];

  return (
    <div className="flex flex-col h-screen w-screen bg-gradient-to-b from-ink-900 to-ink-950 font-body">
      <style>{`
        .chat-scroll::-webkit-scrollbar { width: 5px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 999px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.4); }
      `}</style>

      <div className="flex items-center gap-3 px-5 sm:px-8 py-4 bg-ink-800/90 backdrop-blur-sm border-b border-ink-700/60 shrink-0">
        <button
          onClick={() => navigate("/")}
          aria-label="Back to home"
          className="text-mist-400 hover:text-mist-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full bg-voice/15 ring-1 ring-voice/30 flex items-center justify-center text-voice font-display font-semibold text-sm shrink-0">
          {companyName?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-mist-100 text-sm truncate capitalize">{companyName}</p>
          <p className="text-xs text-voice flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-voice inline-block animate-pulse" /> Online
          </p>
        </div>
        <div className="flex bg-ink-900/80 rounded-lg p-0.5 shrink-0 ring-1 ring-ink-700/50">
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

      <div ref={scrollRef} className="chat-scroll flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-3.5 scroll-smooth">
        <div className="max-w-2xl mx-auto w-full space-y-3.5">
          {messages.map((m) =>
            m.role === "escalation" ? (
              <EscalationBanner key={m.id} />
            ) : (
              <div key={m.id} className={`flex gap-2 animate-msg-in ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-voice/15 ring-1 ring-voice/25 flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-voice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                    </svg>
                  </div>
                )}
                <div className={`flex flex-col max-w-[78%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed flex items-center gap-2 shadow-sm ${m.role === "user"
                      ? "bg-gradient-to-br from-signal to-signal/85 text-white rounded-br-md"
                      : m.role === "system"
                        ? "bg-ink-700/70 text-mist-200 mx-auto text-xs text-center"
                        : "bg-ink-800/80 backdrop-blur-sm text-mist-100 rounded-bl-md border border-ink-700/60"
                      }`}
                  >
                    {m.isVoice && (
                      <svg className="w-4 h-4 shrink-0 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                      </svg>
                    )}
                    <span>{m.text}</span>
                  </div>
                  {m.time && m.role !== "system" && (
                    <span className="text-[10px] text-mist-400/70 mt-1 px-1">{formatTime(m.time)}</span>
                  )}
                </div>
              </div>
            )
          )}
          {orbState === "thinking" && (
            <div className="flex gap-2 items-start animate-msg-in">
              <div className="w-6 h-6 rounded-full bg-voice/15 ring-1 ring-voice/25 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-voice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                </svg>
              </div>
              <div className="bg-ink-800/80 border border-ink-700/60 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
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
      </div>

      <div className="flex flex-col items-center gap-1.5 pb-3 pt-1 shrink-0">
        <VoiceOrb state={orbState} onClick={handleOrbClick} />
        <p className="text-xs text-mist-400">{orbLabel}</p>
      </div>

      <div className="border-t border-ink-700/60 bg-ink-800/90 backdrop-blur-sm px-4 sm:px-8 py-3 shrink-0">
        <div className="max-w-2xl mx-auto w-full">
          {showTextInput ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                className="flex-1 bg-ink-900/80 border border-ink-600/70 rounded-full px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-voice/60 focus:ring-2 focus:ring-voice/20 transition-all"
                placeholder="Type a message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendText()}
              />
              <button
                onClick={handleSendText}
                aria-label="Send message"
                disabled={!input.trim()}
                className="shrink-0 w-10 h-10 rounded-full bg-voice text-ink-950 flex items-center justify-center hover:bg-voice-glow disabled:opacity-40 disabled:hover:bg-voice transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.5 12l18-8-6 8 6 8-18-8z" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTextInput(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-mist-400 hover:text-mist-200 transition-colors py-1.5"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v12H7l-3 3V4z" />
              </svg>
              or type a message instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
