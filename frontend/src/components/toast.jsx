import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = "info") => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    return (
        <ToastContext.Provider value={showToast}>
            {children}
            <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`animate-toast-in max-w-sm px-4 py-3 rounded-xl shadow-xl text-sm font-medium border backdrop-blur-sm flex items-center gap-2
              ${t.type === "error"
                                ? "bg-listen/10 border-listen/40 text-listen"
                                : t.type === "success"
                                    ? "bg-voice/10 border-voice/40 text-voice"
                                    : "bg-ink-800 border-ink-600 text-mist-100"
                            }`}
                    >
                        {t.type === "success" && (
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                        {t.type === "error" && (
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="9" />
                                <path strokeLinecap="round" d="M12 8v5M12 16h.01" />
                            </svg>
                        )}
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within a ToastProvider");
    return ctx;
}