import { useState, createContext, useContext } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div 
            key={t.id} 
            className="pointer-events-auto bg-card border border-[#C56A30]/30 shadow-xl rounded-2xl p-4 min-w-[280px] max-w-md flex items-center justify-between animate-in slide-in-from-right-10 duration-300"
          >
            <div className="flex items-center gap-3">
              {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-[#C56A30]" />}
              {t.type === "error" && <XCircle className="w-5 h-5 text-red-500" />}
              {t.type === "info" && <Info className="w-5 h-5 text-[#C56A30]" />}
              <span className="text-sm font-extrabold text-foreground">{t.message}</span>
            </div>
            <button onClick={() => removeToast(t.id)} className="p-1 hover:bg-accent rounded-full transition-colors ml-4">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
