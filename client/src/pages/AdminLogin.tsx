import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { signInEmail, signOutApi } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { landingFor, ROUTES } from "@/lib/routes";

/** `/admin/login`: staff only. No sign-up, no social sign-in, no hint about other roles. */
export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refetch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  if (user?.id && user.role === "admin" && !busy) return <Navigate to={landingFor("admin", from)} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await signInEmail(email, password);
      const me = await refetch();
      if (!me) { setError("Signed in, but couldn't load your account. Please try again."); return; }
      if (me.role !== "admin") {
        // Not staff: end the session we just opened and give nothing away.
        await signOutApi().catch(() => undefined);
        await refetch();
        setError("These credentials don't have admin access.");
        return;
      }
      navigate(landingFor("admin", from), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full h-12 rounded-xl bg-white/10 border border-white/15 px-4 text-white placeholder:text-white/40 text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-[#C56A30] focus:border-transparent";

  return (
    <main className="min-h-[100dvh] bg-gradient-to-br from-[#2A1A0F] via-[#3D261B] to-[#5C361D] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <Logo iconClassName="h-14 w-auto brightness-0 invert" textClassName="text-2xl font-bold tracking-tight text-white" />
        </div>

        <div className="bg-white/[0.07] backdrop-blur-md border border-white/15 rounded-3xl p-8 shadow-2xl">
          <div className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full bg-[#C56A30]/20 text-[#F0B48A] text-[11px] font-bold uppercase tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5" /><span>Admin console</span>
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-white leading-tight">Admin sign in</h1>
          <p className="text-sm text-white/60 font-medium mt-1.5 mb-6">Restricted to KayaCampus staff.</p>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="text-[13px] font-semibold text-white/80">Work email</label>
              <input id="admin-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@kayacampus.com" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="text-[13px] font-semibold text-white/80">Password</label>
              <div className="relative">
                <input id="admin-password" type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-20`} placeholder="••••••••" />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}{show ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="text-[13px] font-semibold text-red-200 bg-red-500/15 border border-red-400/30 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={busy || !email || !password} className="w-full h-12 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-colors cursor-pointer">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}{busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-white/40 font-medium mt-6">
          Not staff? <a href={ROUTES.student.login} className="text-white/70 hover:text-white underline">Go to the main site</a>
        </p>
      </div>
    </main>
  );
}
