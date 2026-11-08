import { ChevronLeft, Bell, Compass, Moon, User, Phone, ShieldAlert, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useComingSoon } from "@/contexts/ComingSoonContext";
import { useToast } from "@/components/ui/toaster";
import { updateMe } from "@/lib/auth";
import { errorMessage } from "@/lib/adminApi";
import { missingProfileFields, PHONE_RE } from "@/lib/profile";
import { getInitials } from "@/lib/utils";

const INPUT =
  "w-full h-12 bg-white dark:bg-card border rounded-xl px-4 text-[15px] font-medium text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all";
const REQUIRED_TOTAL = 7;

function Field({ label, k, values, set, error, touch, required, placeholder, type = "text", autoComplete, inputMode, hint }: {
  label: string; k: string; values: Record<string, string>; set: (k: string, v: string) => void;
  error?: string; touch: (k: string) => void; required?: boolean; placeholder?: string; type?: string;
  autoComplete?: string; inputMode?: "tel" | "text"; hint?: string;
}) {
  const id = `f-${k}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-foreground">
        {label}{required && <span className="text-red-500" aria-hidden> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      <input
        id={id} name={k} type={type} placeholder={placeholder} value={values[k]} autoComplete={autoComplete} inputMode={inputMode}
        onChange={(e) => set(k, e.target.value)} onBlur={() => touch(k)}
        aria-invalid={!!error} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={`${INPUT} ${error ? "border-red-400" : "border-border/60"}`}
      />
      {error ? <p id={`${id}-err`} role="alert" className="text-[12px] font-semibold text-red-600">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-[12px] text-muted-foreground font-medium">{hint}</p> : null}
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: typeof User; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border/50 border-t-[3px] border-t-[#C56A30]/70 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-5 md:p-7">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C56A30] to-[#B85822] text-white shadow-sm flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
        <div>
          <h2 className="text-[18px] font-extrabold tracking-tight text-foreground leading-tight">{title}</h2>
          {subtitle && <p className="text-[12px] text-muted-foreground font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Set when the student was sent here to finish their profile (e.g. before paying).
  const returnTo: string | undefined = location.state?.returnTo;
  const returnState = location.state?.returnState;
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const { showComingSoon } = useComingSoon();
  const [notifications] = useState(true);
  const [alerts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const d = user?.details;
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const values: Record<string, string> = form ?? {
    name: d?.name ?? user?.name ?? "", phone: d?.phone ?? "", institution: d?.institution ?? "",
    student_id: d?.student_id ?? "", course: d?.course ?? "", level: d?.level ?? "",
    gender: d?.gender ?? "", date_of_birth: d?.date_of_birth ?? "",
    emergency_contact_name: d?.emergency_contact_name ?? "", emergency_contact_phone: d?.emergency_contact_phone ?? "",
  };
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const set = (k: string, v: string) => setForm({ ...values, [k]: v });
  const dirty = form !== null;
  const REQ_LABEL: Record<string, string> = {
    name: "Enter your full name", phone: "Enter your phone number", institution: "Enter your university",
    student_id: "Enter your student ID", course: "Enter your programme", level: "Select your level",
    emergency_contact_name: "Enter a contact name", emergency_contact_phone: "Enter a contact phone number",
  };
  const errorFor = (k: string): string | undefined => {
    const v = values[k].trim();
    if (!(touched[k] || submitted)) return undefined;
    if (REQ_LABEL[k] && !v) return REQ_LABEL[k];
    if ((k === "phone" || k === "emergency_contact_phone") && v && !PHONE_RE.test(v)) return "Use digits only, e.g. 024 123 4567";
    return undefined;
  };
  const missing = missingProfileFields({ ...d, ...values }, "STUDENT");

  const handleSave = async () => {
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()]));
    setSubmitted(true);
    const invalid = ["name", "phone", "emergency_contact_phone"].find(
      (k) => (k === "name" && !v.name) || (k !== "name" && v[k] && !PHONE_RE.test(v[k])),
    );
    if (invalid) {
      toast("Please fix the highlighted fields.", "error");
      document.getElementById(`f-${invalid}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await updateMe(v);
      const fresh = await refetch();
      if (fresh?.details && missingProfileFields(fresh.details, "STUDENT").length > 0) {
        toast("Saved. Some required details are still missing.", "info");
        return;
      }
      toast("Account settings saved.");
      if (returnTo) navigate(returnTo, { replace: true, state: returnState });
      else navigate(-1);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans relative">

      {/* Header */}
      <div className="flex items-center px-5 lg:px-8 h-20 pt-6 lg:pt-8 mb-4 w-full max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center space-x-2 text-foreground hover:opacity-80 transition-opacity cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
          <h1 className="text-xl lg:text-[24px] font-extrabold tracking-tight">Account settings</h1>
        </button>
      </div>

      <div className="px-5 lg:px-8 pb-32 space-y-6 w-full max-w-5xl mx-auto">

        {/* Profile hero + completion */}
        {(() => {
          const done = REQUIRED_TOTAL - Math.min(missing.length, REQUIRED_TOTAL);
          const complete = missing.length === 0;
          const shownName = values.name || user?.email || "";
          return (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3D261B] via-[#7B3C1F] to-[#B85822] text-white p-6 md:p-8 shadow-md">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
              <div className="relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
                <div className="flex items-center gap-4 min-w-0 md:flex-1">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#D3B78F] text-[#6c5e57] font-extrabold text-2xl md:text-3xl flex items-center justify-center border-[3px] border-white/25 shadow-md shrink-0">
                    {getInitials(shownName)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[22px] md:text-[26px] font-extrabold leading-tight truncate">{shownName}</h2>
                    <p className="text-[13px] text-white/80 font-medium truncate">{user?.email}</p>
                    <span className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-extrabold px-3 py-1 rounded-full ${complete ? "bg-emerald-400/25 text-emerald-100" : "bg-white/15 text-white"}`}>
                      {complete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      {complete ? "Profile complete" : "Profile incomplete"}
                    </span>
                  </div>
                </div>
                <div className="md:w-[320px] shrink-0">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[12px] font-extrabold uppercase tracking-widest text-white/80">Profile strength</span>
                    <span className="text-[22px] font-extrabold leading-none">{done}<span className="text-white/60 text-[14px]">/{REQUIRED_TOTAL}</span></span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/20 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={REQUIRED_TOTAL} aria-valuenow={done} aria-label="Profile completion">
                    <div className="h-full rounded-full bg-white dark:bg-card transition-all duration-500" style={{ width: `${(done / REQUIRED_TOTAL) * 100}%` }} />
                  </div>
                  <p className="text-[12px] font-medium text-white/80 mt-2.5">
                    {complete ? "You're all set to book a room." : "Finish these to book a room:"}
                  </p>
                  {!complete && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {missing.map((m) => (
                        <span key={m.key} className="text-[11px] font-bold bg-white/15 rounded-full px-2.5 py-1">{m.label}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <Section icon={User} title="Personal information" subtitle="How you appear to hostel managers.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
            <Field label="Full name" k="name" required autoComplete="name" error={errorFor("name")} values={values} set={set} touch={touch} />
            <div className="space-y-1.5">
              <label htmlFor="f-email" className="text-[13px] font-bold text-foreground">Email</label>
              <input id="f-email" type="email" value={user?.email ?? ""} readOnly aria-describedby="f-email-hint" className={`${INPUT} border-border/60 bg-muted/50 text-muted-foreground cursor-not-allowed`} />
              <p id="f-email-hint" className="text-[12px] text-muted-foreground font-medium">Your sign-in email can't be changed.</p>
            </div>
            <Field label="University" k="institution" required placeholder="e.g. Ashesi University" error={errorFor("institution")} values={values} set={set} touch={touch} />
            <Field label="Programme" k="course" required placeholder="e.g. Business Administration" error={errorFor("course")} values={values} set={set} touch={touch} />
            <Field label="Student ID" k="student_id" required placeholder="e.g. UG-2026-0042" error={errorFor("student_id")} values={values} set={set} touch={touch} />
            <div className="space-y-1.5">
              <label htmlFor="f-level" className="text-[13px] font-bold text-foreground">Level<span className="text-red-500" aria-hidden> *</span><span className="sr-only"> (required)</span></label>
              <select id="f-level" value={values.level} onChange={(e) => set("level", e.target.value)} onBlur={() => touch("level")} aria-invalid={!!errorFor("level")} className={`${INPUT} ${errorFor("level") ? "border-red-400" : "border-border/60"}`}>
                <option value="">Select level</option>
                {["100", "200", "300", "400", "500"].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
              {errorFor("level") && <p role="alert" className="text-[12px] font-semibold text-red-600">{errorFor("level")}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="f-gender" className="text-[13px] font-bold text-foreground">Gender <span className="text-muted-foreground font-medium">(optional)</span></label>
              <select id="f-gender" value={values.gender} onChange={(e) => set("gender", e.target.value)} className={`${INPUT} border-border/60`}>
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="f-date_of_birth" className="text-[13px] font-bold text-foreground">Date of birth <span className="text-muted-foreground font-medium">(optional)</span></label>
              <input id="f-date_of_birth" type="date" autoComplete="bday" value={values.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className={`${INPUT} border-border/60`} />
            </div>
          </div>
        </Section>

        <Section icon={Phone} title="Contact" subtitle="Hostel managers use this to reach you about your booking.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Phone number" k="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 024 123 4567" error={errorFor("phone")} values={values} set={set} touch={touch} />
          </div>
        </Section>

        <Section icon={ShieldAlert} title="Emergency contact" subtitle="Someone your hostel can reach if something happens.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Contact name" k="emergency_contact_name" required placeholder="e.g. Yaa Boateng" error={errorFor("emergency_contact_name")} values={values} set={set} touch={touch} />
            <Field label="Contact phone" k="emergency_contact_phone" required type="tel" inputMode="tel" placeholder="e.g. 020 123 4567" error={errorFor("emergency_contact_phone")} values={values} set={set} touch={touch} />
          </div>
        </Section>

        <Section icon={SlidersHorizontal} title="Preferences">
          <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
            {[
              { icon: Bell, title: "Booking notifications", sub: "Approvals, payment reminders", on: notifications, click: () => showComingSoon("Notification settings") },
              { icon: Compass, title: "New hostel alerts", sub: "When rooms open near campus", on: alerts, click: () => showComingSoon("Hostel alerts") },
              { icon: Moon, title: "Dark mode", sub: "Easier on the eyes at night", on: darkMode, click: () => setDarkMode(!darkMode) },
            ].map(({ icon: Icon, title, sub, on, click }) => (
              <div key={title} className="flex items-center justify-between p-4 min-h-[64px]">
                <div className="flex items-center space-x-4">
                  <Icon className="w-[22px] h-[22px] text-[#C56A30]" />
                  <div>
                    <h3 className="font-bold text-[15px] text-foreground">{title}</h3>
                    <p className="text-[12px] text-muted-foreground font-medium">{sub}</p>
                  </div>
                </div>
                <button
                  type="button" role="switch" aria-checked={on} aria-label={title} onClick={click}
                  className={`w-12 h-[28px] rounded-full relative transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56A30] focus-visible:ring-offset-2 ${on ? "bg-[#C56A30]" : "bg-[#D6CFC8]"}`}
                >
                  <span className={`absolute top-1 w-5 h-5 bg-white dark:bg-card rounded-full transition-transform ${on ? "left-[26px]" : "left-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/60">
        <div className="px-5 lg:px-8 py-3 max-w-5xl mx-auto flex items-center gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={handleSave} disabled={saving} className="h-12 px-8 bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-60 text-white font-bold rounded-full transition-colors shadow-sm text-[15px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C56A30] focus-visible:ring-offset-2">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={() => navigate(-1)} className="h-12 px-8 bg-transparent border border-border/80 text-foreground font-bold rounded-full transition-colors text-[15px] hover:bg-accent/50 cursor-pointer">
            Cancel
          </button>
          {dirty && <span className="text-[12px] font-semibold text-muted-foreground ml-1" aria-live="polite">Unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}
