import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { requestPasswordReset } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { authPath } from "@/lib/routes";

/** `/forgot-password`: students and managers ask for a reset link by email. */
export default function ForgotPassword() {
  const [params] = useSearchParams();
  const role = params.get("role") === "manager" ? "manager" : "student";
  const backTo = authPath(role, "signin");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await requestPasswordReset(email.trim(), role);
      setSent(true);
    } catch (err) {
      // 429 (too many requests) is worth telling them; anything else looks the same as success.
      if (err instanceof ApiError && err.status === 429) setError(err.message);
      else if (err instanceof ApiError && err.status < 500) setSent(true);
      else setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#F8F6F3] dark:bg-background flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8"><Logo iconClassName="h-12 w-auto" textClassName="text-2xl font-bold tracking-tight text-foreground" /></div>
        <div className="bg-white dark:bg-card border border-[#E5E0D8] dark:border-border rounded-3xl p-8 shadow-sm">
          {sent ? (
            <div className="text-center">
              <span className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400 flex items-center justify-center"><MailCheck className="w-7 h-7" /></span>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#3D261B] dark:text-foreground mb-2">Check your email</h1>
              <p className="text-sm font-medium text-[#8C8279] dark:text-muted-foreground leading-relaxed">
                If an account exists for <span className="font-bold text-foreground">{email}</span>, we've sent a link to choose a new password. It works once and expires in an hour.
              </p>
              <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground mt-4">Nothing in your inbox? Check spam, or <button onClick={() => setSent(false)} className="font-bold text-canyon hover:underline cursor-pointer">try another address</button>.</p>
            </div>
          ) : (
            <>
              <h1 className="text-[24px] font-extrabold tracking-tight text-[#3D261B] dark:text-foreground mb-1.5">Forgot your password?</h1>
              <p className="text-sm font-medium text-[#8C8279] dark:text-muted-foreground mb-6">Enter the email you signed up with and we'll send you a link to reset it.</p>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="fp-email" className="text-sm font-semibold text-[#463C38] dark:text-foreground">{role === "manager" ? "Business email" : "University email"}</label>
                  <input
                    id="fp-email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === "manager" ? "you@yourhostel.com" : "sarah.adjei@ashesi.edu.gh"}
                    className="w-full h-12 rounded-xl bg-white dark:bg-background border border-[#E5E0D8] dark:border-border px-4 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-canyon/40"
                  />
                </div>
                {error && <p role="alert" className="text-[13px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
                <button type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} className="w-full h-12 rounded-full bg-canyon text-white font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>
        <Link to={backTo} className="mt-6 flex items-center justify-center gap-1.5 text-sm font-bold text-[#8C8279] hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back to sign in</Link>
      </div>
    </main>
  );
}
