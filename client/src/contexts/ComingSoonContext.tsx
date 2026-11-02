import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Construction } from "lucide-react";

interface ComingSoonContextValue {
  /** Opens the "still working on this" screen. `feature` names what was tapped. */
  showComingSoon: (feature?: string) => void;
}

const ComingSoonContext = createContext<ComingSoonContextValue | undefined>(undefined);

export function ComingSoonProvider({ children }: { children: ReactNode }) {
  // `null` = closed; a string (possibly empty) = open for that feature.
  const [feature, setFeature] = useState<string | null>(null);

  const showComingSoon = useCallback((name = "") => setFeature(name), []);
  const close = useCallback(() => setFeature(null), []);

  useEffect(() => {
    if (feature === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [feature, close]);

  return (
    <ComingSoonContext.Provider value={{ showComingSoon }}>
      {children}
      {feature !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="coming-soon-title"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-background/95 backdrop-blur-sm p-6 animate-in fade-in duration-200"
          onClick={close}
        >
          <div
            className="w-full max-w-md text-center flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Construction className="w-9 h-9 text-primary" />
            </div>
            <h2 id="coming-soon-title" className="text-2xl font-extrabold tracking-tight text-foreground mb-3">
              We're still working on this
            </h2>
            <p className="text-[15px] font-medium text-muted-foreground leading-relaxed mb-8">
              {feature ? `${feature} is` : "This feature is"} not available yet, but it's coming soon.
              Thank you for your patience!
            </p>
            <button
              type="button"
              autoFocus
              onClick={close}
              className="h-12 px-10 rounded-full bg-primary text-primary-foreground font-bold text-[15px] shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </ComingSoonContext.Provider>
  );
}

export function useComingSoon(): ComingSoonContextValue {
  const context = useContext(ComingSoonContext);
  if (context === undefined) {
    throw new Error("useComingSoon must be used within a ComingSoonProvider");
  }
  return context;
}
