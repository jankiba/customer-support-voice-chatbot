import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import Home from "./components/Home";
import AdminDashboard from "./components/AdminDashboard";
import ChatWidget from "./components/ChatWidget";
import { ToastProvider } from "./components/toast";

function SupportPage() {
  const { slug } = useParams();
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-voice/10 blur-3xl" />
      <div className="relative">
        <ChatWidget companySlug={slug} companyName={slug.replace(/-/g, " ")} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/support/:slug" element={<SupportPage />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}