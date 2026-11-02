import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { getSettings, updateSettings, errorMessage } from "@/lib/adminApi";

const inputClass =
  "w-full h-12 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-[#C56A30] outline-none disabled:opacity-60";

export default function AdminSettings() {
  const [platformName, setPlatformName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setPlatformName(s.platform_name);
        setSupportEmail(s.support_email);
        setMaintenance(s.maintenance_mode);
        setSavedAt(s.updated_at);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const s = await updateSettings({
        platform_name: platformName,
        support_email: supportEmail,
        maintenance_mode: maintenance,
      });
      setSavedAt(s.updated_at);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-[28px] font-extrabold tracking-tight text-foreground pb-6 mb-6 border-b border-solid border-border/80">Platform settings</h1>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground mb-4">General Configuration</h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Platform Name</label>
              <input
                type="text"
                value={platformName}
                disabled={loading}
                onChange={(e) => setPlatformName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                disabled={loading}
                onChange={(e) => setSupportEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/40">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground mb-4">System Maintenance</h2>

          <div className="flex items-center justify-between p-4 bg-[#FAF8F5] border border-border/40 rounded-2xl">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-[#C56A30]" />
              <div>
                <h4 className="font-extrabold text-sm text-foreground">Maintenance Mode</h4>
                <p className="text-xs text-muted-foreground font-medium">
                  Pauses new student bookings. Existing bookings and browsing are unaffected.
                </p>
              </div>
            </div>

            <button
              onClick={() => setMaintenance(!maintenance)}
              disabled={loading}
              aria-pressed={maintenance}
              className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${maintenance ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${maintenance ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-4">
          <button
            onClick={save}
            disabled={loading || saving}
            className="h-11 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm cursor-pointer disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save settings"}
          </button>
          {savedAt && (
            <span className="text-xs font-medium text-muted-foreground">
              Last saved {new Date(savedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
