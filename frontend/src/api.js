import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Admin ----------
export const registerCompany = (data) => api.post("/admin/register", data);
export const loginCompany = (data) => api.post("/admin/login", data);
export const verifyLoginOtp = (data) => api.post("/admin/verify-otp", data);
export const resendLoginOtp = (email) => api.post("/admin/resend-otp", { email });
export const getMyCompany = () => api.get("/admin/me");

// ---------- Knowledge base ----------
export const uploadDocument = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/knowledge-base/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
};
export const listDocuments = () => api.get("/knowledge-base/documents");
export const deleteDocument = (id) => api.delete(`/knowledge-base/documents/${id}`);

// ---------- Dashboard ----------
export const listTickets = () => api.get("/tickets");
export const listConversations = () => api.get("/conversations");

// ---------- Team ----------
export const listTeamMembers = () => api.get("/admin/team");
export const inviteTeamMember = (data) => api.post("/admin/team", data);
export const removeTeamMember = (id) => api.delete(`/admin/team/${id}`);

// ---------- Analytics ----------
export const getAnalyticsSummary = () => api.get("/analytics/summary");

// ---------- Public company lookup ----------
export const resolveCompany = (name) => api.get("/companies/resolve", { params: { name } });

// ---------- Customer chat (public, no auth) ----------
export const sendTextMessage = (slug, sessionId, message, language = "en") =>
  api.post(`/chat/${slug}/text`, { session_id: sessionId, message, language });

export const sendVoiceMessage = (slug, sessionId, audioBlob, language = "en") => {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  return api.post(`/chat/${slug}/voice?session_id=${sessionId}&language=${language}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getChatHistory = (slug, sessionId) =>
  api.get(`/chat/${slug}/history?session_id=${sessionId}`);

export const getChatSuggestions = (slug) => api.get(`/chat/${slug}/suggestions`);

export const audioUrl = (path) => `${API_BASE}${path}`;

export default api;