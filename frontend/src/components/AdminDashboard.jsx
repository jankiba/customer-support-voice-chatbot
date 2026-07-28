import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  registerCompany,
  loginCompany,
  verifyLoginOtp,
  resendLoginOtp,
  getMyCompany,
  uploadDocument,
  listDocuments,
  deleteDocument,
  listTickets,
  listConversations,
  listTeamMembers,
  inviteTeamMember,
  removeTeamMember,
  getAnalyticsSummary,
} from "../api";
import { useToast } from "./Toast";
import { SkeletonList, EmptyState } from "./Skeleton";

const NAV = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "knowledge-base", label: "Knowledge Base", icon: "doc" },
  { id: "tickets", label: "Tickets", icon: "ticket" },
  { id: "conversations", label: "Conversations", icon: "chat" },
  { id: "analytics", label: "Analytics", icon: "chart" },
  { id: "team", label: "Team", icon: "team" },
];

const ICONS = {
  grid: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  doc: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2v6h6" />
    </svg>
  ),
  ticket: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M5 6h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V8a2 2 0 012-2z" />
    </svg>
  ),
  chat: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
    </svg>
  ),
  chart: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M8 17V9m5 8V5m5 12v-6" />
    </svg>
  ),
  team: (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m5-7.13a4 4 0 110 8 4 4 0 010-8zm7 3a4 4 0 11-1.13-2.79" />
    </svg>
  ),
};

function priorityBadgeClasses(priority) {
  if (priority === "high") return "bg-listen/15 text-listen";
  if (priority === "medium") return "bg-signal/15 text-signal";
  return "bg-ink-700 text-mist-400";
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5 flex items-start justify-between">
      <div>
        <p className="text-mist-400 text-xs">{label}</p>
        <p className="font-display text-2xl font-semibold text-mist-100 mt-1">{value}</p>
      </div>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [company, setCompany] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [mode, setMode] = useState("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [section, setSection] = useState("overview");
  const [documents, setDocuments] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [conversations, setConversations] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [analytics, setAnalytics] = useState(null);
  const [teamMembers, setTeamMembers] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      getMyCompany()
        .then(({ data }) => setCompany(data))
        .catch(() => localStorage.removeItem("admin_token"))
        .finally(() => setCheckingSession(false));
    } else {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    if (!company) return;
    listDocuments().then(({ data }) => setDocuments(data));
    listTickets().then(({ data }) => setTickets(data));
    listConversations().then(({ data }) => setConversations(data));
    getAnalyticsSummary().then(({ data }) => setAnalytics(data));
    listTeamMembers().then(({ data }) => setTeamMembers(data));
  }, [company]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await loginCompany({ email, password });
      setAwaitingOtp(true);
      setOtpNotice(`We sent a 6-digit code to ${email}.`);
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerCompany({ name: companyName, email, password });
      await loginCompany({ email, password });
      setAwaitingOtp(true);
      setOtpNotice(`Account created. We sent a 6-digit code to ${email}.`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create account. Try a different email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { data } = await verifyLoginOtp({ email, otp });
      localStorage.setItem("admin_token", data.access_token);
      const me = await getMyCompany();
      setCompany(me.data);
      setAwaitingOtp(false);
      setOtp("");
      toast("Logged in successfully", "success");
    } catch {
      setError("Incorrect or expired code. Try again or resend.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setOtpNotice("");
    try {
      await resendLoginOtp(email);
      setOtpNotice(`We sent a new code to ${email}.`);
      toast("Code resent", "success");
    } catch {
      setError("Could not resend code. Try logging in again.");
    }
  }

  function handleBackToLogin() {
    setAwaitingOtp(false);
    setOtp("");
    setError("");
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    setCompany(null);
  }

  async function doUpload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast("Only PDF files are supported", "error");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadDocument(file, (pct) => setUploadProgress(pct));
      const { data } = await listDocuments();
      setDocuments(data);
      toast(`${file.name} uploaded`, "success");
    } catch {
      toast("Upload failed. Try again.", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleFileInputChange(e) {
    doUpload(e.target.files[0]);
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    doUpload(e.dataTransfer.files[0]);
  }

  async function handleDeleteDocument(doc) {
    if (!window.confirm(`Delete "${doc.filename}"? Your assistant will no longer be able to answer from it.`)) {
      return;
    }
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast(`${doc.filename} deleted`, "success");
    } catch {
      toast("Could not delete document. Try again.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleInviteMember(e) {
    e.preventDefault();
    setInviting(true);
    try {
      await inviteTeamMember({ email: inviteEmail, password: invitePassword });
      const { data } = await listTeamMembers();
      setTeamMembers(data);
      setInviteEmail("");
      setInvitePassword("");
      toast("Team member added", "success");
    } catch (err) {
      toast(err?.response?.data?.detail || "Could not add team member", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(member) {
    if (!window.confirm(`Remove ${member.email} from your team?`)) return;
    setRemovingMemberId(member.id);
    try {
      await removeTeamMember(member.id);
      setTeamMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast("Team member removed", "success");
    } catch {
      toast("Could not remove team member", "error");
    } finally {
      setRemovingMemberId(null);
    }
  }

  if (checkingSession) {
    return <div className="min-h-screen bg-ink-950" />;
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-ink-950 font-body flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-ink-700 bg-ink-900">
          <button
            onClick={() => navigate("/")}
            aria-label="Back to home"
            className="text-mist-400 hover:text-mist-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-mist-400 text-sm">Back to home</span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-ink-900 border border-ink-700 rounded-2xl p-8 animate-fade-in">
            {awaitingOtp ? (
              <>
                <div className="mb-5">
                  <button
                    onClick={handleBackToLogin}
                    className="text-mist-400 hover:text-mist-100 text-xs mb-3 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <h1 className="font-display text-xl font-semibold text-mist-100">Enter your code</h1>
                  <p className="text-mist-400 text-sm mt-1">{otpNotice}</p>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <input
                    autoFocus
                    className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] text-mist-100 placeholder-mist-400 focus:outline-none focus:border-voice"
                    placeholder="------"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                  {error && <p className="text-listen text-sm">{error}</p>}
                  <button
                    disabled={submitting || otp.length !== 6}
                    className="w-full bg-voice text-ink-950 rounded-xl py-2.5 text-sm font-semibold hover:bg-voice-glow transition-colors disabled:opacity-60"
                  >
                    {submitting ? "Verifying…" : "Verify & continue"}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="w-full text-center text-xs text-mist-400 hover:text-mist-200 transition-colors"
                  >
                    Resend code
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h1 className="font-display text-xl font-semibold text-mist-100">
                    {mode === "login" ? "Admin Login" : "Create your account"}
                  </h1>
                  <p className="text-mist-400 text-sm mt-1">
                    {mode === "login" ? "Manage your support assistant" : "Set up a new support assistant"}
                  </p>
                </div>

                <div className="flex mb-6 bg-ink-800 rounded-xl p-1">
                  <button
                    onClick={() => { setMode("login"); setError(""); }}
                    className={`flex-1 text-sm py-2 rounded-lg transition-colors ${mode === "login" ? "bg-signal text-white font-medium" : "text-mist-400 hover:text-mist-200"
                      }`}
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => { setMode("signup"); setError(""); }}
                    className={`flex-1 text-sm py-2 rounded-lg transition-colors ${mode === "signup" ? "bg-signal text-white font-medium" : "text-mist-400 hover:text-mist-200"
                      }`}
                  >
                    Sign Up
                  </button>
                </div>

                <form onSubmit={mode === "login" ? handleLogin : handleSignup} className="space-y-4">
                  {mode === "signup" && (
                    <input
                      className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-signal"
                      placeholder="Company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  )}
                  <input
                    className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-signal"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-signal"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {error && <p className="text-listen text-sm">{error}</p>}
                  <button
                    disabled={submitting}
                    className="w-full bg-signal text-white rounded-xl py-2.5 text-sm font-medium hover:bg-signal-dim transition-colors disabled:opacity-60"
                  >
                    {submitting
                      ? mode === "login" ? "Logging in…" : "Creating account…"
                      : mode === "login" ? "Log in" : "Create account"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const openTickets = (tickets || []).length;
  const totalChunks = (documents || []).reduce((sum, d) => sum + (d.chunk_count || 0), 0);

  return (
    <div className="min-h-screen bg-ink-950 font-body flex">
      <aside className="w-64 shrink-0 border-r border-ink-700 bg-ink-900 flex flex-col">
        <div className="px-5 py-5 border-b border-ink-700">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-mist-400 hover:text-mist-100 text-xs mb-4 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-signal/15 flex items-center justify-center text-signal font-display font-semibold">
              {company.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-mist-100 truncate">{company.name}</p>
              <p className="text-[11px] text-mist-400 truncate">/support/{company.slug}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${section === n.id
                ? "bg-voice/10 text-voice font-medium"
                : "text-mist-400 hover:bg-ink-800 hover:text-mist-100"
                }`}
            >
              {ICONS[n.icon]}
              {n.label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-ink-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-mist-400 hover:bg-listen/10 hover:text-listen transition-colors"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <div key={section} className="animate-fade-in">
            {section === "overview" && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Overview</h1>
                  <p className="text-mist-400 text-sm mt-1">A quick look at your support assistant</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <StatCard
                    label="Documents"
                    value={documents === null ? "—" : documents.length}
                    icon={ICONS.doc}
                    accent="bg-voice/15 text-voice"
                  />
                  <StatCard
                    label="Chunks indexed"
                    value={documents === null ? "—" : totalChunks}
                    icon={ICONS.grid}
                    accent="bg-signal/15 text-signal"
                  />
                  <StatCard
                    label="Support tickets"
                    value={tickets === null ? "—" : openTickets}
                    icon={ICONS.ticket}
                    accent="bg-listen/15 text-listen"
                  />
                </div>

                {documents !== null && documents.length === 0 && (
                  <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6">
                    <p className="font-display text-mist-100 font-semibold mb-1">Get your assistant ready</p>
                    <p className="text-mist-400 text-sm mb-4">
                      Upload a PDF — a return policy, FAQ, or product manual — so customers get real answers instead of escalations.
                    </p>
                    <button
                      onClick={() => setSection("knowledge-base")}
                      className="bg-voice text-ink-950 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-voice-glow transition-colors"
                    >
                      Upload a document
                    </button>
                  </div>
                )}

                <div className="bg-ink-900 border border-ink-700 rounded-2xl p-5">
                  <p className="text-mist-400 text-xs mb-1">Public chatbot URL</p>
                  <code className="text-voice text-sm">/support/{company.slug}</code>
                </div>
              </div>
            )}

            {section === "knowledge-base" && (
              <div className="space-y-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Knowledge Base</h1>
                  <p className="text-mist-400 text-sm mt-1">Documents your assistant answers from</p>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed px-6 py-8 flex flex-col items-center text-center cursor-pointer transition-colors
                    ${dragActive ? "border-voice bg-voice/5" : "border-ink-700 hover:border-ink-600"}`}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" hidden onChange={handleFileInputChange} />
                  <div className="w-11 h-11 rounded-full bg-voice/15 flex items-center justify-center text-voice mb-3">
                    {ICONS.upload}
                  </div>
                  {uploading ? (
                    <div className="w-full max-w-xs">
                      <p className="text-mist-200 text-sm mb-2">Uploading… {uploadProgress}%</p>
                      <div className="h-1.5 w-full bg-ink-700 rounded-full overflow-hidden">
                        <div className="h-full bg-voice transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-mist-200 text-sm font-medium">Drop a PDF here, or click to browse</p>
                      <p className="text-mist-400 text-xs mt-1">Return policies, FAQs, product manuals — anything customers might ask about</p>
                    </>
                  )}
                </div>

                {documents === null ? (
                  <SkeletonList rows={3} />
                ) : documents.length === 0 ? (
                  <EmptyState icon={ICONS.doc} title="No documents yet" subtitle="Upload a PDF above to give your assistant something to answer from." />
                ) : (
                  <ul className="divide-y divide-ink-700 border border-ink-700 rounded-xl overflow-hidden">
                    {documents.map((d) => (
                      <li key={d.id} className="px-4 py-3 text-sm flex items-center justify-between bg-ink-900 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-mist-400 shrink-0">{ICONS.doc}</span>
                          <span className="text-mist-100 truncate">{d.filename}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-mist-400 text-xs">{d.chunk_count} chunks</span>
                          <button
                            onClick={() => handleDeleteDocument(d)}
                            disabled={deletingId === d.id}
                            aria-label={`Delete ${d.filename}`}
                            className="text-mist-400 hover:text-listen transition-colors disabled:opacity-40"
                          >
                            {deletingId === d.id ? (
                              <span className="block w-4 h-4 border-2 border-mist-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              ICONS.trash
                            )}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "tickets" && (
              <div className="space-y-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Tickets</h1>
                  <p className="text-mist-400 text-sm mt-1">Conversations escalated to a human</p>
                </div>
                {tickets === null ? (
                  <SkeletonList rows={3} />
                ) : tickets.length === 0 ? (
                  <EmptyState icon={ICONS.ticket} title="No support tickets" subtitle="Escalated conversations that need a human will show up here." />
                ) : (
                  <ul className="divide-y divide-ink-700 border border-ink-700 rounded-xl overflow-hidden">
                    {tickets.map((t) => (
                      <li key={t.id} className="px-4 py-3.5 text-sm bg-ink-900">
                        <div className="flex justify-between items-start gap-3">
                          <span className="font-medium text-mist-100">{t.subject}</span>
                          <span className={`text-xs uppercase px-2 py-0.5 rounded-full shrink-0 ${priorityBadgeClasses(t.priority)}`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-mist-400 mt-1">{t.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "conversations" && (
              <div className="space-y-4">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Conversations</h1>
                  <p className="text-mist-400 text-sm mt-1">Every question your assistant has answered</p>
                </div>
                {conversations === null ? (
                  <SkeletonList rows={3} />
                ) : conversations.length === 0 ? (
                  <EmptyState icon={ICONS.chat} title="No conversations yet" subtitle="Customer questions and answers will appear here once your chatbot starts getting used." />
                ) : (
                  <ul className="divide-y divide-ink-700 border border-ink-700 rounded-xl overflow-hidden">
                    {conversations.map((c) => (
                      <li key={c.id} className="px-4 py-3.5 text-sm space-y-1 bg-ink-900">
                        <p className="text-mist-100"><span className="font-medium">Q:</span> {c.customer_question}</p>
                        <p className="text-mist-400"><span className="font-medium">A:</span> {c.bot_answer}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {section === "analytics" && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Analytics</h1>
                  <p className="text-mist-400 text-sm mt-1">How your assistant is performing</p>
                </div>

                {analytics === null ? (
                  <SkeletonList rows={4} />
                ) : (
                  <>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <StatCard
                        label="Total conversations"
                        value={analytics.total_conversations}
                        icon={ICONS.chat}
                        accent="bg-voice/15 text-voice"
                      />
                      <StatCard
                        label="Escalations"
                        value={analytics.total_escalations}
                        icon={ICONS.ticket}
                        accent="bg-listen/15 text-listen"
                      />
                      <StatCard
                        label="Escalation rate"
                        value={`${analytics.escalation_rate}%`}
                        icon={ICONS.chart}
                        accent="bg-signal/15 text-signal"
                      />
                    </div>

                    <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6">
                      <p className="font-display text-mist-100 font-semibold mb-5">Conversations — last 7 days</p>
                      <div className="flex items-end justify-between gap-3 h-32">
                        {analytics.conversations_by_day.map((d) => {
                          const max = Math.max(...analytics.conversations_by_day.map((x) => x.count), 1);
                          const heightPct = (d.count / max) * 100;
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                              <span className="text-xs text-mist-400">{d.count}</span>
                              <div
                                className="w-full bg-voice/70 rounded-t-md min-h-[3px] transition-all"
                                style={{ height: `${heightPct}%` }}
                              />
                              <span className="text-[10px] text-mist-400">
                                {new Date(d.date).toLocaleDateString([], { weekday: "short" })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6">
                      <p className="font-display text-mist-100 font-semibold mb-4">Tickets by priority</p>
                      <div className="space-y-3">
                        {["high", "medium", "low"].map((p) => {
                          const count = analytics.tickets_by_priority[p] || 0;
                          const total = Object.values(analytics.tickets_by_priority).reduce((a, b) => a + b, 0) || 1;
                          const pct = (count / total) * 100;
                          return (
                            <div key={p}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className={`uppercase ${priorityBadgeClasses(p).split(" ")[1]}`}>{p}</span>
                                <span className="text-mist-400">{count}</span>
                              </div>
                              <div className="h-2 bg-ink-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${p === "high" ? "bg-listen" : p === "medium" ? "bg-signal" : "bg-mist-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {section === "team" && (
              <div className="space-y-6">
                <div>
                  <h1 className="font-display text-2xl font-semibold text-mist-100">Team</h1>
                  <p className="text-mist-400 text-sm mt-1">Everyone who can manage this assistant</p>
                </div>

                {teamMembers === null ? (
                  <SkeletonList rows={2} />
                ) : (
                  <ul className="divide-y divide-ink-700 border border-ink-700 rounded-xl overflow-hidden">
                    {teamMembers.map((m) => (
                      <li key={m.id} className="px-4 py-3.5 text-sm flex items-center justify-between bg-ink-900">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-signal/15 flex items-center justify-center text-signal font-display font-semibold text-xs shrink-0">
                            {m.email[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-mist-100 truncate">{m.email}</p>
                            <p className="text-mist-400 text-xs capitalize">{m.role}</p>
                          </div>
                        </div>
                        {m.role !== "owner" && (
                          <button
                            onClick={() => handleRemoveMember(m)}
                            disabled={removingMemberId === m.id}
                            aria-label={`Remove ${m.email}`}
                            className="text-mist-400 hover:text-listen transition-colors disabled:opacity-40 shrink-0 ml-3"
                          >
                            {removingMemberId === m.id ? (
                              <span className="block w-4 h-4 border-2 border-mist-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              ICONS.trash
                            )}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="bg-ink-900 border border-ink-700 rounded-2xl p-6">
                  <p className="font-display text-mist-100 font-semibold mb-4">Add a team member</p>
                  <form onSubmit={handleInviteMember} className="space-y-3">
                    <input
                      className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-signal"
                      placeholder="Email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                    <input
                      className="w-full bg-ink-800 border border-ink-600 rounded-xl px-4 py-2.5 text-sm text-mist-100 placeholder-mist-400 focus:outline-none focus:border-signal"
                      placeholder="Temporary password"
                      type="password"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      required
                    />
                    <button
                      disabled={inviting}
                      className="bg-signal text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-signal-dim transition-colors disabled:opacity-60"
                    >
                      {inviting ? "Adding…" : "Add team member"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
