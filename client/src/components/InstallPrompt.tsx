import { useEffect, useState, type ReactNode } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "other";

const DISMISS_KEY = "campusnest-install-dismissed-at";
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 4000;

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || isIPadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </svg>
);

const PlusSquareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const MenuDotsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12" />
    <path d="m8 11 4 4 4-4" />
    <path d="M5 21h14" />
  </svg>
);

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-black/5 dark:bg-white/10 px-3 py-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C56A30] text-xs font-semibold text-white">
        {n}
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#C56A30] shadow-sm dark:bg-neutral-800">
        {icon}
      </span>
      <span className="text-sm leading-snug">{children}</span>
    </li>
  );
}

export default function InstallPrompt() {
  const [platform] = useState<Platform>(() => detectPlatform());
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    // iOS and Android only: desktop browsers get the native install icon instead.
    const timer =
      platform !== "other"
        ? window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
        : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, [platform]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: just hide for this session */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setVisible(false);
    else dismiss();
  };

  if (!visible || platform === "other") return null;

  return (
    <div
      role="dialog"
      aria-label="Install CampusNest"
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-4 text-neutral-900 shadow-2xl dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-100">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl border border-black/10" />
          <div className="flex-1">
            <p className="text-base font-semibold">Install CampusNest</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Add it to your home screen for faster access and a full-screen app experience.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {platform === "ios" && (
          <ol className="mt-3 space-y-2">
            <Step n={1} icon={<ShareIcon />}>
              Tap the <strong>Share</strong> button in Safari's toolbar.
            </Step>
            <Step n={2} icon={<PlusSquareIcon />}>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </Step>
            <Step n={3} icon={<span className="text-xs font-bold">Add</span>}>
              Tap <strong>Add</strong> in the top-right corner.
            </Step>
          </ol>
        )}

        {platform === "android" && (
          <>
            {deferred ? (
              <button
                type="button"
                onClick={install}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C56A30] px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]"
              >
                <DownloadIcon /> Install app
              </button>
            ) : (
              <ol className="mt-3 space-y-2">
                <Step n={1} icon={<MenuDotsIcon />}>
                  Tap the <strong>menu</strong> (three dots) in Chrome.
                </Step>
                <Step n={2} icon={<DownloadIcon />}>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </Step>
                <Step n={3} icon={<span className="text-xs font-bold">OK</span>}>
                  Confirm with <strong>Install</strong>.
                </Step>
              </ol>
            )}
          </>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
