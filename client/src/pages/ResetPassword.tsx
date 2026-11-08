import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import Logo from "@/components/Logo";
import { resetPassword } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { authPath, ROUTES } from "@/lib/routes";
import { passwordProblem, passwordStrength } from "@/lib/password";
import { useToast } from "@/components/ui/toaster";

const STRENGTH = ["", "Weak", "Okay", "Good", "Strong"];

/** `/reset-password?token=…`: where the emailed link lands. */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = params.get("token");
  const linkBad = !token || params.get("error") === "INVALID_TOKEN";
  const role = params.get("role") === "manager" ? "manager" : "student";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strength = passwordStrength(pw);
  const problem = pw ? passwordProblem(pw, confirm || undefined) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pw, confirm);
    if (p) { setError(p); return; }
    setBusy(true); setError(null);
    try {
      await resetPassword(token!, pw);
      toast("Password changed. Sign in with your new password.");
      navigate(authPath(role, "signin"), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400
        ? "This reset link has expired or was already used. Request a new one."
        : "Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full h-12 rounded-xl bg-white dark:bg-background border border-[#E5E0D8] dark:border-border px-4 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-canyon/40";

  return (
    <main className="min-h-[100dvh] bg-[#F8F6F3] dark:bg-background flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8"><Logo iconClassName="h-12 w-auto" textClassName="text-2xl font-bold tracking-tight text-foreground" /></div>
        <div className="bg-white dark:bg-card border border-[#E5E0D8] dark:border-border rounded-3xl p-8 shadow-sm">
          {linkBad ? (
            <div className="text-center">
              <span className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center"><TriangleAlert className="w-7 h-7" /></span>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#3D261B] dark:text-foreground mb-2">This link isn't valid</h1>
              <p className="text-sm font-medium text-[#8C8279] dark:text-muted-foreground mb-6">It may have expired or already been used. Reset links work once and last an hour.</p>
              <Link to={`${ROUTES.student.forgotPassword}?role=${role}`} className="inline-flex h-12 px-8 items-center rounded-full bg-canyon text-white font-bold text-[15px]">Request a new link</Link>
            </div>
          ) : (
            <>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#3D261B] dark:text-foreground mb-1.5">Choose a new password</h1>
              <p className="text-sm font-medium text-[#8C8279] dark:text-muted-foreground mb-6">Use at least 8 characters. You'll be signed out on every device.</p>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="rp-new" className="text-sm font-semibold text-[#463C38] dark:text-foreground">New password</label>
                  <div className="relative">
                    <input id="rp-new" type={show ? "text" : "password"} autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} className={`${input} pr-20`} />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8279] hover:text-foreground text-xs font-semibold flex items-center gap-1 cursor-pointer">
                      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{show ? "Hide" : "Show"}
                    </button>
                  </div>
                  {pw && (
                    <div className="flex items-center gap-2 pt-1" aria-live="polite">
                      <div className="flex gap-1 flex-1">{[1, 2, 3, 4].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= strength ? (strength <= 1 ? "bg-red-500" : strength === 2 ? "bg-amber-500" : "bg-emerald-500") : "bg-[#E5E0D8] dark:bg-border"}`} />)}</div>
                      <span className="text-[11px] font-bold text-[#8C8279]">{STRENGTH[strength]}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="rp-confirm" className="text-sm font-semibold text-[#463C38] dark:text-foreground">Confirm new password</label>
                  <input id="rp-confirm" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
                </div>
                {(error || (confirm && problem)) && <p role="alert" className="text-[13px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 rounded-lg px-3 py-2">{error || problem}</p>}
                <button type="submit" disabled={busy || !pw || !confirm} className="w-full h-12 rounded-full bg-canyon text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? "Saving…" : "Change password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
