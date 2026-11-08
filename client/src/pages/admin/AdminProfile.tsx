import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/toaster";
import { updateMe } from "@/lib/auth";
import { changePassword, errorMessage } from "@/lib/adminApi";
import { ErrorBanner, PageHeader } from "@/components/admin/AdminUI";

const field = "w-full h-12 px-4 rounded-xl border border-border bg-card text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#C56A30]/40";

/** The signed-in admin's own details and password. */
export default function AdminProfile() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const shownName = name ?? user?.name ?? "";
  const nameChanged = shownName.trim() !== "" && shownName.trim() !== user?.name;

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    try { await updateMe({ name: shownName.trim() }); await refetch(); setName(null); toast("Name updated."); }
    catch (err) { toast(errorMessage(err), "error"); }
    finally { setSavingName(false); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (pw.next.length < 8) { setPwError("The new password must be at least 8 characters."); return; }
    if (pw.next !== pw.confirm) { setPwError("The two new passwords don't match."); return; }
    if (pw.next === pw.current) { setPwError("Choose a password you haven't used here before."); return; }
    setSavingPw(true);
    try { await changePassword(pw.current, pw.next); setPw({ current: "", next: "", confirm: "" }); toast("Password changed. Other devices were signed out."); }
    catch (err) { setPwError(errorMessage(err)); }
    finally { setSavingPw(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="My account" subtitle={user?.email} />

      <form onSubmit={saveName} className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-[16px] font-extrabold text-foreground">Details</h2>
        <div><label htmlFor="ap-name" className="text-[12px] font-bold block mb-1.5">Full name</label><input id="ap-name" className={field} value={shownName} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="ap-email" className="text-[12px] font-bold block mb-1.5">Email</label><input id="ap-email" className={`${field} bg-muted/50 text-muted-foreground cursor-not-allowed`} value={user?.email ?? ""} readOnly /></div>
        <button type="submit" disabled={!nameChanged || savingName} className="h-11 px-6 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">{savingName && <Loader2 className="w-4 h-4 animate-spin" />}Save name</button>
      </form>

      <form onSubmit={savePassword} className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-[16px] font-extrabold text-foreground">Change password</h2>
        <div><label htmlFor="pw-cur" className="text-[12px] font-bold block mb-1.5">Current password</label><input id="pw-cur" type="password" autoComplete="current-password" className={field} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
        <div><label htmlFor="pw-new" className="text-[12px] font-bold block mb-1.5">New password (8+ characters)</label><input id="pw-new" type="password" autoComplete="new-password" className={field} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
        <div><label htmlFor="pw-conf" className="text-[12px] font-bold block mb-1.5">Confirm new password</label><input id="pw-conf" type="password" autoComplete="new-password" className={field} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
        <ErrorBanner message={pwError} />
        <button type="submit" disabled={savingPw || !pw.current || !pw.next} className="h-11 px-6 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">{savingPw && <Loader2 className="w-4 h-4 animate-spin" />}Change password</button>
        <p className="text-[12px] font-medium text-muted-foreground">Changing your password signs you out of every other device.</p>
      </form>
    </div>
  );
}
