import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/apiClient";
import { fetchReviews } from "@/lib/reviews";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/toaster";
import { updateMe } from "@/lib/auth";
import { missingProfileFields, PHONE_RE } from "@/lib/profile";
import { errorMessage } from "@/lib/adminApi";
import { useManagerBookings } from "@/data/managerBookings";

interface Bank { bankName: string; accountNumber: string; accountName: string }
interface Extras {
  phone: string; ghanaCard: string; businessName: string; network: string; momoNumber: string; accountName: string;
  bank?: Bank | null;
  /** Which payout account earnings go to. */
  primary?: "momo" | "bank";
}
const BANKS = ["GCB Bank", "Ecobank Ghana", "Fidelity Bank", "Stanbic Bank", "Absa Bank Ghana", "CalBank", "Zenith Bank", "Access Bank", "United Bank for Africa", "Republic Bank"];
const EMPTY_BANK: Bank = { bankName: BANKS[0], accountNumber: "", accountName: "" };
const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";
const maskNumber = (n: string) => `···· ···· ${n.replace(/\D/g, "").slice(-4)}`;
import { ShieldCheck, Phone as PhoneIcon, Pencil, Plus } from "lucide-react";

export default function ManagerProfile() {
  const [isEditing, setIsEditing] = useState(false);
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const d = user?.details;
  // The properties this manager really owns, with their approval status.
  const [owned, setOwned] = useState<{ id: string; hostel_name: string; status: "PENDING" | "APPROVED" | "REJECTED" }[] | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ id: string; hostel_name: string; status: "PENDING" | "APPROVED" | "REJECTED" }[]>("/users/me/hostels")
      .then(async (rows) => {
        if (cancelled) return;
        setOwned(rows);
        const live = rows.filter((h) => h.status === "APPROVED");
        const all = (await Promise.all(live.map((h) => fetchReviews(h.id).catch(() => [])))).flat();
        if (!cancelled) setRating(all.length ? all.reduce((s, r) => s + r.rating, 0) / all.length : null);
      })
      .catch(() => { if (!cancelled) setOwned([]); });
    return () => { cancelled = true; };
  }, []);
  const liveProperties = (owned ?? []).filter((h) => h.status === "APPROVED");
  const memberSince = user?.details?.createdAt
    ? new Date(user.details.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;

  const extras: Extras = {
    phone: d?.phone ?? "", ghanaCard: d?.ghana_card_number ?? "", businessName: d?.business_name ?? "",
    network: d?.momo_network || "MTN MoMo", momoNumber: d?.momo_number ?? "", accountName: user?.name ?? "",
    bank: d?.bank_account_number
      ? { bankName: d.bank_name ?? BANKS[0], accountNumber: d.bank_account_number, accountName: d.bank_account_name ?? "" }
      : null,
    primary: d?.payout_method ?? (d?.momo_number ? "momo" : d?.bank_account_number ? "bank" : undefined),
  };
  const missing = missingProfileFields(d, "HOSTEL_MANAGER");
  const { bookings } = useManagerBookings();
  const residents = bookings.filter((b) => b.status === "Confirmed").length;
  const name = user?.name ?? "";
  const [draft, setDraft] = useState<(Extras & { name: string; tab: "momo" | "bank" }) | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (tab: "momo" | "bank" = extras.primary ?? "momo") => {
    setDraft({
      ...extras, accountName: extras.accountName || name, name, tab,
      bank: extras.bank ?? { ...EMPTY_BANK, accountName: name },
    });
    setIsEditing(true);
  };
  const cancelEdit = () => { setDraft(null); setIsEditing(false); };
  const patch = (p: Partial<Extras & { name: string; tab: "momo" | "bank" }>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const save = async () => {
    if (!draft) return;
    const newName = draft.name.trim();
    if (!newName) { toast("Name can't be empty.", "error"); return; }
    const bank = draft.bank ?? EMPTY_BANK;
    if (!draft.phone.trim() || !PHONE_RE.test(draft.phone.trim())) { toast("Enter a valid phone number.", "error"); return; }
    if (!draft.businessName.trim()) { toast("Enter your hostel or business name.", "error"); return; }
    if (draft.tab === "bank") {
      if (!/^\d{6,20}$/.test(bank.accountNumber.replace(/\s/g, ""))) { toast("Enter a valid bank account number (digits only).", "error"); return; }
      if (!bank.accountName.trim()) { toast("Enter the bank account name.", "error"); return; }
    } else if (!PHONE_RE.test(draft.momoNumber.trim())) {
      toast("Enter a valid MoMo number.", "error"); return;
    }
    const payment_details = draft.tab === "bank"
      ? `${bank.bankName} · ${bank.accountNumber.replace(/\s/g, "")} · ${bank.accountName.trim()}`
      : `${draft.network} · ${draft.momoNumber.trim()} · ${draft.accountName.trim() || newName}`;
    setSaving(true);
    try {
      const hasBank = !!bank.accountNumber.trim();
      await updateMe({
        name: newName, payment_details,
        phone: draft.phone.trim(), business_name: draft.businessName.trim(), ghana_card_number: draft.ghanaCard.trim(),
        payout_method: draft.tab, momo_network: draft.network, momo_number: draft.momoNumber.trim(),
        bank_name: hasBank ? bank.bankName : "", bank_account_number: hasBank ? bank.accountNumber.replace(/\s/g, "") : "",
        bank_account_name: hasBank ? bank.accountName.trim() : "",
      });
      await refetch();
      toast("Profile saved.");
      setDraft(null);
      setIsEditing(false);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-6 lg:pb-12 bg-[#F0EFEA] h-full">
      {/* Header */}
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 flex items-center justify-between border-b border-solid border-[#E5D0BA]/50 mb-6">
        <h1 className="text-xl lg:text-2xl font-bold text-[#463C38]">My profile</h1>
        <div className="flex items-center space-x-3">
        {!isEditing && <NotificationsDropdown />}
        {isEditing && (
          <div className="flex items-center space-x-2">
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="border border-[#E5E0D8] bg-white text-[#5C4538] hover:bg-[#F8F6F3] px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-60 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-colors"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
        </div>
      </div>

      <div className="px-5 lg:px-8 w-full">
        {missing.length > 0 && !isEditing && (
          <button
            onClick={() => startEdit()}
            className="w-full text-left mb-6 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 p-4 shadow-sm hover:bg-amber-100/70 transition-colors"
          >
            <span className="block text-[14px] font-extrabold">Complete your profile</span>
            <span className="block text-[12px] font-medium mt-0.5">Still needed: {missing.map((m) => m.label).join(", ")}. Tap to fill in.</span>
          </button>
        )}
        {!isEditing ? (
          /* View Mode */
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Left Column (Avatar Card) */}
            <div className="flex-1 lg:max-w-xs">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex flex-col items-center">
                <div className="w-full h-24 bg-[#A84A1A]"></div>
                <div className="w-20 h-20 bg-[#463C38] rounded-full flex items-center justify-center text-white font-bold text-2xl border-4 border-white -mt-10 mb-3 z-10 shrink-0 shadow-sm">
                  {initialsOf(name)}
                </div>
                
                <h2 className="text-lg font-bold text-[#463C38]">{name}</h2>
                <p className="text-[13px] font-medium text-[#8C8279] mt-0.5">Manager{extras.businessName || liveProperties[0] ? ` · ${extras.businessName || liveProperties[0].hostel_name}` : ""}</p>
                
                <div className="flex space-x-2 mt-4 mb-6">
                  {extras.ghanaCard && (
                    <span className="flex items-center space-x-1 bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>ID provided</span>
                    </span>
                  )}
                  {extras.phone && (
                    <span className="flex items-center space-x-1 bg-[#F1E8DC] text-[#A84A1A] px-2.5 py-1 rounded-full text-[11px] font-bold">
                      <PhoneIcon className="w-3.5 h-3.5" />
                      <span>Phone</span>
                    </span>
                  )}
                </div>

                <div className="w-full grid grid-cols-3 border-t border-[#F0EFEA] divide-x divide-[#F0EFEA] py-4">
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[#463C38] text-[15px]">{owned ? liveProperties.length : "–"}</span>
                    <span className="text-[11px] font-medium text-[#8C8279]">{liveProperties.length === 1 ? "property" : "properties"}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[#463C38] text-[15px]">{residents}</span>
                    <span className="text-[11px] font-medium text-[#8C8279]">residents</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-bold text-[#463C38] text-[15px]">{rating ? rating.toFixed(1) : "–"}</span>
                    <span className="text-[11px] font-medium text-[#8C8279]">rating</span>
                  </div>
                </div>
                
                <div className="w-full text-center py-3 border-t border-[#F0EFEA] bg-[#F8F6F3]">
                  <span className="text-[11px] font-medium text-[#8C8279]">{memberSince ? `Member since ${memberSince}` : "Hostel manager"}</span>
                </div>
              </div>
            </div>

            {/* Right Column (Info Cards) */}
            <div className="flex-[2] space-y-6">
              
              {/* My properties */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-[#463C38]">My properties</h3>
                  <Link to={ROUTES.manager.properties} className="text-[12px] font-bold text-[#A84A1A] hover:underline">Manage</Link>
                </div>
                {owned === null ? (
                  <p className="text-[13px] font-medium text-[#8C8279]">Loading…</p>
                ) : owned.length === 0 ? (
                  <p className="text-[13px] font-medium text-[#8C8279]">You don't own any properties yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {owned.map((h) => {
                      const chip = h.status === "APPROVED" ? { t: "Live", c: "bg-emerald-50 text-emerald-600" }
                        : h.status === "PENDING" ? { t: "Awaiting approval", c: "bg-amber-50 text-amber-700" }
                        : { t: "Not approved", c: "bg-red-50 text-red-600" };
                      const row = (
                        <div className="flex items-center justify-between bg-[#F8F6F3] rounded-xl px-4 py-3 border border-[#E5E0D8]/50">
                          <span className="text-[14px] font-bold text-[#463C38]">{h.hostel_name}</span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${chip.c}`}>{chip.t}</span>
                        </div>
                      );
                      return <li key={h.id}>{h.status === "APPROVED" ? <Link to={`/manager/properties/${h.id}`} className="block hover:opacity-90">{row}</Link> : row}</li>;
                    })}
                  </ul>
                )}
              </div>

              {/* Contact details */}
              <div className="bg-white rounded-2xl p-6 shadow-sm relative">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-[#463C38]">Contact details</h3>
                  <button onClick={() => startEdit()} className="flex items-center space-x-1 border border-[#E5E0D8] text-[#A84A1A] hover:bg-[#F1E8DC]/50 px-4 py-2 rounded-full font-bold text-[12px] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <span className="block text-[11px] font-medium text-[#A29A91] mb-1">Full name</span>
                    <span className="block text-[14px] font-bold text-[#463C38]">{name}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-[#A29A91] mb-1">Phone</span>
                    <span className="block text-[14px] font-bold text-[#463C38]">{extras.phone || "Not set"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-[#A29A91] mb-1">Hostel / business name</span>
                    <span className="block text-[14px] font-bold text-[#463C38]">{extras.businessName || "Not set"}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-[#A29A91] mb-1">Email</span>
                    <span className="block text-[14px] font-bold text-[#463C38]">{user?.email}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-[#A29A91] mb-1">Ghana Card ID</span>
                    <span className="block text-[14px] font-bold text-[#463C38]">{extras.ghanaCard || "Not set"}</span>
                  </div>
                </div>
              </div>

              {/* Payout account */}
              <div className="bg-white rounded-2xl p-6 shadow-sm relative">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-[#463C38]">Payout account</h3>
                  <button onClick={() => startEdit()} className="flex items-center space-x-1 border border-[#E5E0D8] text-[#A84A1A] hover:bg-[#F1E8DC]/50 px-4 py-2 rounded-full font-bold text-[12px] transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>

                {(["momo", "bank"] as const)
                  .filter((m) => (m === "momo" ? !!extras.momoNumber : !!extras.bank))
                  .map((m) => (
                    <div key={m} className="bg-[#F8F6F3] rounded-xl p-4 flex items-center justify-between mb-4 border border-[#E5E0D8]/50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#E5D0BA] text-[#A84A1A] rounded-full flex items-center justify-center shrink-0">
                          {m === "momo" ? <PhoneIcon className="w-4 h-4" /> : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[13px] font-bold text-[#463C38]">
                            {m === "momo" ? `${extras.network} · ${extras.accountName || name}` : `${extras.bank!.bankName} · ${extras.bank!.accountName}`}
                          </span>
                          <span className="text-[12px] font-medium text-[#8C8279] mt-0.5">
                            {maskNumber(m === "momo" ? extras.momoNumber : extras.bank!.accountNumber)}
                          </span>
                        </div>
                      </div>
                      {(extras.primary ?? "momo") === m && (
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold">Primary</span>
                      )}
                    </div>
                  ))}

                {!extras.bank && !!extras.momoNumber && (
                  <button onClick={() => startEdit("bank")} className="w-full flex items-center justify-center space-x-1.5 bg-transparent border border-dashed border-[#C8B09A] text-[#A84A1A] py-3 rounded-xl font-bold text-[13px] hover:bg-[#F1E8DC]/50 transition-colors">
                    <Plus className="w-4 h-4" />
                    <span>Add bank account</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-6 lg:space-y-8 w-full">
            
            {/* Header / Avatar Edit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-[#463C38] rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-sm">
                  {initialsOf(draft?.name ?? name)}
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-[#463C38]">{draft?.name ?? name}</h2>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-[12px] font-medium text-[#8C8279]">Hostel manager</span>
                  </div>
                </div>
              </div>
              <button className="border border-[#E5E0D8] text-[#5C4538] hover:bg-[#F8F6F3] px-4 py-2 rounded-full font-bold text-[12px] transition-colors">
                Change photo
              </button>
            </div>

            {/* Personal Information */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#463C38] mb-5">Personal information</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Full name</label>
                  <input 
                    type="text" 
                    value={draft?.name ?? ""} onChange={(e) => patch({ name: e.target.value })}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Phone *</label>
                  <input 
                    type="text" 
                    value={draft?.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Hostel / business name *</label>
                  <input
                    type="text"
                    value={draft?.businessName ?? ""} onChange={(e) => patch({ businessName: e.target.value })}
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Email</label>
                  <input 
                    type="email" 
                    value={user?.email ?? ""} readOnly title="Email can't be changed"
                    className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Ghana Card ID</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={draft?.ghanaCard ?? ""} onChange={(e) => patch({ ghanaCard: e.target.value })}
                      className="w-full border border-[#E5E0D8] rounded-xl pl-4 pr-20 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-[11px] flex items-center">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Optional
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payout Account Edit */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="mb-5">
                <h3 className="text-base font-bold text-[#463C38]">Payout account</h3>
                <p className="text-[12px] font-medium text-[#8C8279] mt-0.5">Where Kaya sends your booking earnings.</p>
              </div>

              <div className="flex p-1 bg-[#F8F6F3] rounded-xl mb-6">
                {([
                  { id: "momo", label: "Mobile Money" },
                  { id: "bank", label: "Bank account" },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => patch({ tab: t.id })}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-[13px] flex items-center justify-center space-x-2 transition-colors ${
                      draft?.tab === t.id ? "bg-white border border-[#E5D0BA] text-[#A84A1A] shadow-sm" : "text-[#8C8279] hover:text-[#463C38]"
                    }`}
                  >
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[12px] font-medium text-[#8C8279] -mt-3 mb-5">Earnings are paid to the account you save here.</p>

              {draft?.tab === "bank" ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Bank</label>
                    <select value={draft.bank?.bankName ?? BANKS[0]} onChange={(e) => patch({ bank: { ...(draft.bank ?? EMPTY_BANK), bankName: e.target.value } })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all appearance-none bg-white">
                      {BANKS.map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Account number</label>
                      <input type="text" inputMode="numeric" placeholder="e.g. 1234567890123" value={draft.bank?.accountNumber ?? ""} onChange={(e) => patch({ bank: { ...(draft.bank ?? EMPTY_BANK), accountNumber: e.target.value } })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Account name</label>
                      <input type="text" value={draft.bank?.accountName ?? ""} onChange={(e) => patch({ bank: { ...(draft.bank ?? EMPTY_BANK), accountName: e.target.value } })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                    <div>
                      <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Network</label>
                      <select value={draft?.network ?? "MTN MoMo"} onChange={(e) => patch({ network: e.target.value })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all appearance-none bg-white">
                        <option>MTN MoMo</option>
                        <option>Telecel Cash</option>
                        <option>AT Money</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#A29A91] mb-2">MoMo number</label>
                      <input type="text" value={draft?.momoNumber ?? ""} onChange={(e) => patch({ momoNumber: e.target.value })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#A29A91] mb-2">Account name</label>
                    <input type="text" value={draft?.accountName ?? ""} onChange={(e) => patch({ accountName: e.target.value })} className="w-full border border-[#E5E0D8] rounded-xl px-4 py-3 text-[14px] font-medium text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20 transition-all" />
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-base font-bold text-[#463C38] mb-5">Notifications</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-[#463C38] text-[14px]">New booking requests</h4>
                    <p className="text-[12px] font-medium text-[#8C8279] mt-0.5">Get notified the moment a student books</p>
                  </div>
                  <button className="w-11 h-6 rounded-full bg-[#A84A1A] flex items-center p-1 transition-colors">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm transform translate-x-5 transition-transform" />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-[#F0EFEA]">
                  <div>
                    <h4 className="font-bold text-[#463C38] text-[14px]">Payout confirmations</h4>
                    <p className="text-[12px] font-medium text-[#8C8279] mt-0.5">SMS when earnings hit your account</p>
                  </div>
                  <button className="w-11 h-6 rounded-full bg-[#A84A1A] flex items-center p-1 transition-colors">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm transform translate-x-5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
