import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  createAdminUser, errorMessage, getAdminUserDetail, listAdminUsers, setUserSuspension, formatGHS,
  type AdminUser, type AdminUserDetail,
} from "@/lib/adminApi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/toaster";
import { Chip, DetailRow, EmptyState, ErrorBanner, Modal, PageHeader, ReasonDialog, SearchBox, Spinner, Tabs } from "@/components/admin/AdminUI";
import { getInitials } from "@/lib/utils";

type Tab = "STUDENT" | "HOSTEL_MANAGER" | "ADMIN";
const TAB_LABEL: Record<Tab, string> = { STUDENT: "Students", HOSTEL_MANAGER: "Managers", ADMIN: "Admins" };
const AVATAR_BG = ["bg-[#D2BDA7] text-[#5A4535]", "bg-[#6B8E68] text-white", "bg-[#4A3B32] text-white", "bg-[#6A5A8E] text-white", "bg-[#5E8B9E] text-white"];
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const avatarFor = (id: string) => AVATAR_BG[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_BG.length];

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("STUDENT");
  const [query, setQuery] = useState("");
  const [showSuspended, setShowSuspended] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    listAdminUsers().then((rows) => { setUsers(rows); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { STUDENT: 0, HOSTEL_MANAGER: 0, ADMIN: 0 };
    (users ?? []).forEach((u) => { c[u.user_type]++; });
    return c;
  }, [users]);
  const suspendedCount = (users ?? []).filter((u) => u.suspended_at).length;

  const shown = (users ?? []).filter((u) => {
    if (u.user_type !== tab) return false;
    if (showSuspended && !u.suspended_at) return false;
    const q = query.trim().toLowerCase();
    return !q || [u.name, u.email, u.institution, u.business_name, u.student_id].some((v) => v?.toLowerCase().includes(q));
  }).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const reactivate = async (u: AdminUser) => {
    try { await setUserSuspension(u.id, false); toast(`${u.name} can sign in again.`); load(); }
    catch (e) { toast(errorMessage(e), "error"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle={users ? `${users.length} accounts${suspendedCount ? ` · ${suspendedCount} suspended` : ""}` : "Loading…"}
        actions={
          <>
            <SearchBox value={query} onChange={setQuery} placeholder="Search name, email, school…" />
            <button onClick={() => setAdding(true)} className="h-11 px-5 rounded-full bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer"><Plus className="w-4 h-4" />Add admin</button>
          </>
        }
      />
      <ErrorBanner message={error} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs active={tab} onChange={setTab} tabs={(Object.keys(TAB_LABEL) as Tab[]).map((t) => ({ id: t, label: TAB_LABEL[t], count: users ? counts[t] : undefined }))} />
        <label className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={showSuspended} onChange={(e) => setShowSuspended(e.target.checked)} className="accent-[#C56A30] w-4 h-4" />Suspended only
        </label>
      </div>

      {!users && !error && <Spinner />}
      {users && shown.length === 0 && <EmptyState title="No users match" text="Try another tab or search." />}

      {shown.length > 0 && (
        <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase bg-muted/40">
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">{tab === "HOSTEL_MANAGER" ? "Business" : tab === "ADMIN" ? "Role" : "School"}</th>
                  <th className="py-4 px-6">Joined</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {shown.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                    <td className="py-4 px-6">
                      <button onClick={() => setOpenId(u.id)} className="flex items-center gap-3 text-left cursor-pointer">
                        <span className={`w-10 h-10 rounded-full ${avatarFor(u.id)} font-extrabold text-xs flex items-center justify-center shrink-0`}>{getInitials(u.name || u.email)}</span>
                        <span>
                          <span className="block font-extrabold text-[14px] text-foreground leading-tight">{u.name || "—"}{u.id === me?.id && <span className="ml-2 text-[10px] font-extrabold text-[#C56A30]">YOU</span>}</span>
                          <span className="block text-[12px] text-muted-foreground font-medium">{u.email}</span>
                        </span>
                      </button>
                    </td>
                    <td className="py-4 px-6 font-bold text-[13px] text-foreground/80">{tab === "HOSTEL_MANAGER" ? u.business_name || "—" : tab === "ADMIN" ? "Platform admin" : u.institution || "—"}</td>
                    <td className="py-4 px-6 text-[13px] text-muted-foreground font-medium whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                    <td className="py-4 px-6">
                      {u.suspended_at ? <Chip tone="red">Suspended</Chip> : u.profile_complete ? <Chip tone="green">Active</Chip> : <Chip tone="amber">Profile incomplete</Chip>}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button onClick={() => setOpenId(u.id)} className="h-9 px-4 rounded-full border border-border font-bold text-xs hover:bg-accent cursor-pointer mr-2">View</button>
                      {u.id !== me?.id && (u.suspended_at
                        ? <button onClick={() => reactivate(u)} className="h-9 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer">Reactivate</button>
                        : <button onClick={() => setSuspendTarget(u)} className="h-9 px-4 rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold text-xs cursor-pointer">Suspend</button>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && (
        <UserDetail
          id={openId} isMe={openId === me?.id} onClose={() => setOpenId(null)}
          onSuspend={(u) => setSuspendTarget(u)} onReactivate={(u) => reactivate(u).then(() => setOpenId(null))}
        />
      )}
      {suspendTarget && (
        <ReasonDialog
          title={`Suspend ${suspendTarget.name || suspendTarget.email}?`}
          description="They are signed out straight away and can't sign in again until you reactivate the account."
          confirmLabel="Suspend account" required minLength={3}
          onConfirm={async (reason) => { await setUserSuspension(suspendTarget.id, true, reason); toast(`${suspendTarget.name || suspendTarget.email} was suspended.`); setOpenId(null); load(); }}
          onClose={() => setSuspendTarget(null)}
        />
      )}
      {adding && <AddAdmin onClose={() => setAdding(false)} onCreated={() => { setAdding(false); setTab("ADMIN"); load(); }} />}
    </div>
  );
}

function UserDetail({ id, isMe, onClose, onSuspend, onReactivate }: {
  id: string; isMe: boolean; onClose: () => void; onSuspend: (u: AdminUser) => void; onReactivate: (u: AdminUser) => void;
}) {
  const [d, setD] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { getAdminUserDetail(id).then(setD).catch((e) => setError(errorMessage(e))); }, [id]);


  return (
    <Modal title={d?.name || "User"} onClose={onClose} wide>
      {error && <ErrorBanner message={error} />}
      {!d && !error && <Spinner />}
      {d && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tone="brand">{TAB_LABEL[d.user_type].replace(/s$/, "")}</Chip>
            {d.suspended_at ? <Chip tone="red">Suspended</Chip> : d.profile_complete ? <Chip tone="green">Active</Chip> : <Chip tone="amber">Profile incomplete</Chip>}
            {d.emailVerified && <Chip tone="blue">Email verified</Chip>}
          </div>
          {d.suspended_at && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-[13px]">
              <p className="font-extrabold text-red-700 dark:text-red-300">Suspended on {fmtDate(d.suspended_at)}</p>
              {d.suspended_reason && <p className="font-medium text-red-700/80 dark:text-red-300/80 mt-1">{d.suspended_reason}</p>}
            </div>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <DetailRow label="Email" value={<a href={`mailto:${d.email}`} className="text-[#C56A30] hover:underline">{d.email}</a>} />
            <DetailRow label="Phone" value={d.phone} />
            <DetailRow label="Joined" value={fmtDate(d.createdAt)} />
            {d.user_type === "STUDENT" && (<>
              <DetailRow label="Institution" value={d.institution} />
              <DetailRow label="Programme" value={d.course} />
              <DetailRow label="Level" value={d.level} />
              <DetailRow label="Student ID" value={d.student_id} />
              <DetailRow label="Gender" value={d.gender} />
              <DetailRow label="Emergency contact" value={d.emergency_contact_name ? `${d.emergency_contact_name} · ${d.emergency_contact_phone ?? ""}` : undefined} />
            </>)}
            {d.user_type === "HOSTEL_MANAGER" && (<>
              <DetailRow label="Business" value={d.business_name} />
              <DetailRow label="Ghana Card" value={d.ghana_card_number} />
              <DetailRow label="Payout" value={d.payout_method === "bank" ? `${d.bank_name ?? "Bank"} (bank account)` : d.momo_network ? `${d.momo_network} (mobile money)` : undefined} />
            </>)}
          </dl>

          {d.user_type === "STUDENT" && (
            <section>
              <h3 className="text-[14px] font-extrabold text-foreground mb-3">Bookings</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Total", d.booking_counts.total], ["Approved", d.booking_counts.confirmed], ["Pending", d.booking_counts.pending], ["Paid", formatGHS(d.booking_counts.spent)]].map(([l, v]) => (
                  <div key={l as string} className="rounded-xl border border-border p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</p><p className="text-[18px] font-extrabold text-foreground">{v}</p></div>
                ))}
              </div>
            </section>
          )}
          {d.user_type === "HOSTEL_MANAGER" && (
            <section>
              <h3 className="text-[14px] font-extrabold text-foreground mb-3">Hostels</h3>
              {d.hostels.length === 0 ? <p className="text-[13px] font-medium text-muted-foreground">No hostels.</p> : (
                <ul className="space-y-2">{d.hostels.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                    <span className="font-bold text-[14px]">{h.hostel_name}</span>
                    <Chip tone={h.status === "APPROVED" ? "green" : h.status === "PENDING" ? "amber" : "red"}>{h.status === "APPROVED" ? "Live" : h.status === "PENDING" ? "Awaiting approval" : "Rejected"}</Chip>
                  </li>))}</ul>
              )}
            </section>
          )}

          {!isMe && (
            <div className="flex justify-end pt-4 border-t border-border/50">
              {d.suspended_at
                ? <button onClick={() => onReactivate(d)} className="h-10 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer">Reactivate account</button>
                : <button onClick={() => onSuspend(d)} className="h-10 px-6 rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-extrabold text-xs cursor-pointer">Suspend account</button>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AddAdmin({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = form.name.trim() && /^\S+@\S+\.\S+$/.test(form.email) && form.password.length >= 8;
  const field = "w-full h-11 px-4 rounded-xl border border-border bg-background text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#C56A30]/40";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError(null);
    try { await createAdminUser({ name: form.name.trim(), email: form.email.trim(), password: form.password }); toast(`Admin account created for ${form.email}.`); onCreated(); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  };

  return (
    <Modal title="Add an admin" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-[13px] font-medium text-muted-foreground">They can sign in at the admin page straight away. Share the password privately and ask them to change it.</p>
        <div><label htmlFor="adm-name" className="text-[12px] font-bold block mb-1.5">Full name</label><input id="adm-name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label htmlFor="adm-email" className="text-[12px] font-bold block mb-1.5">Work email</label><input id="adm-email" type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label htmlFor="adm-pass" className="text-[12px] font-bold block mb-1.5">Temporary password (8+ characters)</label><input id="adm-pass" type="password" autoComplete="new-password" className={field} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {error && <p role="alert" className="text-[12px] font-bold text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="h-11 px-6 rounded-full border border-border font-bold text-sm cursor-pointer">Cancel</button>
          <button type="submit" disabled={!valid || busy} className="h-11 px-6 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Create admin</button>
        </div>
      </form>
    </Modal>
  );
}
