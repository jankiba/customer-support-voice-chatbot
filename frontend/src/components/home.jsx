import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveCompany } from "../api";
import { useToast } from "./Toast";

export default function Home() {
  const [slug, setSlug] = useState("");
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function handleGoToChat(e) {
    e.preventDefault();
    if (!slug.trim() || searching) return;
    setSearching(true);
    try {
      const { data } = await resolveCompany(slug.trim());
      navigate(`/support/${data.slug}`);
    } catch {
      toast(`Couldn't find a company called "${slug.trim()}". Check the spelling?`, "error");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 font-body flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-voice/10 blur-3xl" />

      <button
        onClick={() => navigate("/admin")}
        className="absolute top-6 right-6 flex items-center gap-1.5 text-xs text-mist-400 hover:text-mist-200 transition-colors z-10"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
        </svg>
        Business admin
      </button>

      <div className="relative max-w-lg w-full text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-voice animate-pulse" />
          <span className="text-xs tracking-widest uppercase text-mist-400">Voice-first support</span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-mist-100 tracking-tight mb-4">
          Ask anything.<br />Get an instant answer.
        </h1>
        <p className="text-mist-400 text-base mb-10">
          Talk or type your question and get an answer grounded in your company's own documentation — no waiting on hold.
        </p>

        <form onSubmit={handleGoToChat} className="space-y-3">
          <input
            autoFocus
            className="w-full bg-ink-900 border border-ink-700 rounded-2xl px-5 py-3.5 text-sm text-mist-100 placeholder-mist-400 text-center focus:outline-none focus:border-voice transition-colors"
            placeholder="Enter company name (e.g. xyz)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <button
            type="submit"
            disabled={searching}
            className="w-full bg-voice text-ink-950 rounded-2xl py-3.5 text-sm font-semibold hover:bg-voice-glow transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path strokeLinecap="round" d="M5 10a7 7 0 0 0 14 0M12 19v3" />
            </svg>
            {searching ? "Finding company…" : "Start Chat"}
          </button>
        </form>

        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-mist-400">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-voice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Instant answers
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-voice" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Grounded in your docs
          </span>
        </div>
      </div>
    </div>
  );
}