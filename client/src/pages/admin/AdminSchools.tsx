import { useCallback, useEffect, useState } from "react";
import { Plus, GraduationCap, MapPin, X, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/AdminUI";
import { useToast } from "@/components/ui/toaster";
import {
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  getSchoolHostels,
  getUnassignedHostels,
  assignHostel,
  unassignHostel,
  errorMessage,
  type School,
  type SchoolHostel,
  type HostelStatus,
} from "@/lib/adminApi";

const STATUS_LABEL: Record<HostelStatus, string> = {
  APPROVED: "Live",
  PENDING: "Pending",
  REJECTED: "Off",
};

const inputClass =
  "w-full h-11 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-[#C56A30] outline-none";

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hostels, setHostels] = useState<SchoolHostel[]>([]);
  const [unassigned, setUnassigned] = useState<SchoolHostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddSchool, setShowAddSchool] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", email_domain: "" });
  const [savingSchool, setSavingSchool] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [busyHostel, setBusyHostel] = useState<string | null>(null);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", location: "", email_domain: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selected = schools.find((s) => s.id === selectedId) ?? null;

  const loadSchools = useCallback(async () => {
    const list = await getSchools();
    setSchools(list);
    setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
  }, []);

  useEffect(() => {
    loadSchools()
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [loadSchools]);

  const loadHostels = useCallback(async (schoolId: string) => {
    const [own, free] = await Promise.all([getSchoolHostels(schoolId), getUnassignedHostels()]);
    setHostels(own ?? []);
    setUnassigned(free);
  }, []);

  useEffect(() => {
    setShowPicker(false);
    if (!selectedId) {
      setHostels([]);
      return;
    }
    loadHostels(selectedId).catch((e) => setError(errorMessage(e)));
  }, [selectedId, loadHostels]);

  const submitSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchool(true);
    setError(null);
    try {
      const created = await createSchool(form);
      setForm({ name: "", location: "", email_domain: "" });
      setShowAddSchool(false);
      await loadSchools();
      setSelectedId(created.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingSchool(false);
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditForm({ name: selected.name, location: selected.location, email_domain: selected.email_domain });
    setEditError(null);
    setEditing(true);
  };
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSavingEdit(true); setEditError(null);
    try {
      await updateSchool(selected.id, editForm);
      await loadSchools();
      setEditing(false);
      toast("School updated.");
    } catch (err) {
      setEditError(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  // Attach/detach change hostel counts too, so refresh both lists.
  const changeHostel = async (hostelId: string, action: "assign" | "unassign") => {
    if (!selectedId) return;
    setBusyHostel(hostelId);
    setError(null);
    try {
      if (action === "assign") await assignHostel(selectedId, hostelId);
      else await unassignHostel(selectedId, hostelId);
      await Promise.all([loadHostels(selectedId), loadSchools()]);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyHostel(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-solid border-border/80">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Schools</h1>
        <button
          onClick={() => setShowAddSchool((v) => !v)}
          className="h-11 px-6 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm inline-flex items-center space-x-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add school</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>
      )}

      {showAddSchool && (
        <form
          onSubmit={submitSchool}
          className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ashesi University" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Location</label>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Berekuso, Eastern Region" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Student email domain</label>
            <input required value={form.email_domain} onChange={(e) => setForm({ ...form, email_domain: e.target.value })} placeholder="ashesi.edu.gh" className={inputClass} />
          </div>
          <div className="sm:col-span-3 flex gap-3">
            <button
              type="submit"
              disabled={savingSchool}
              className="h-10 px-6 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              {savingSchool ? "Saving…" : "Create school"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddSchool(false)}
              className="h-10 px-6 bg-white border border-border/50 text-foreground font-extrabold text-xs rounded-full hover:bg-accent transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm font-medium text-muted-foreground">Loading schools…</p>
      ) : schools.length === 0 ? (
        <p className="text-sm font-medium text-muted-foreground">No schools yet. Add the first one above.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-y-6 lg:gap-x-0">
          {/* Left Column: School Selector List */}
          <div className="space-y-3 lg:border-r border-border/80 lg:pr-6">
            {schools.map((school) => {
              const isSelected = selectedId === school.id;
              return (
                <div
                  key={school.id}
                  onClick={() => setSelectedId(school.id)}
                  className={`p-4 rounded-[20px] transition-all cursor-pointer border flex items-center space-x-4 ${
                    isSelected
                      ? "bg-[#FAF0E6] border-[#C56A30]/40 shadow-sm"
                      : "bg-card border-border/40 hover:bg-accent/40"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-[#C56A30] text-white" : "bg-[#F8F4EE] text-[#C56A30]"
                  }`}>
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[15px] text-foreground">{school.name}</h3>
                    <p className="text-[12px] text-muted-foreground font-medium">
                      {school.hostel_count} hostels · {school.student_count} students
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Selected School Details & Map */}
          {selected && (
            <div className="lg:col-span-2 space-y-6 lg:pl-6">
              {/* Map Header Box */}
              <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                  <h2 className="text-[22px] font-extrabold text-foreground leading-tight">{selected.name}</h2>
                  <p className="text-[13px] text-muted-foreground font-medium flex items-center space-x-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#C56A30]" />
                    <span>{selected.location}</span>
                    <span>· @{selected.email_domain}</span>
                  </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={startEdit} aria-label="Edit school" className="h-9 px-4 rounded-full border border-border/60 text-xs font-extrabold flex items-center gap-1.5 hover:bg-accent cursor-pointer"><Pencil className="w-3.5 h-3.5" />Edit</button>
                    <button onClick={() => setConfirmDelete(true)} aria-label="Delete school" className="h-9 w-9 rounded-full border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Campus Map Placeholder Graphic */}
                <div
                  className="w-full h-56 rounded-2xl bg-[#E8DDD0] border border-[#D2BDA7]/60 flex items-center justify-center relative overflow-hidden shadow-inner"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(197, 106, 48, 0.15) 12px, rgba(197, 106, 48, 0.15) 16px)'
                  }}
                >
                  <div className="px-4 py-2 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full shadow-sm">
                    <span className="text-[11px] font-extrabold tracking-widest text-[#C56A30] uppercase">
                      CAMPUS MAP — HOSTELS PINNED AROUND {selected.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hostels near this school */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-lg text-foreground">Hostels near this school</h3>
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    className="h-9 px-4 bg-white border border-border/50 text-foreground font-extrabold text-xs rounded-full hover:bg-accent transition-colors shadow-sm inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#C56A30]" />
                    <span>Add hostel</span>
                  </button>
                </div>

                {showPicker && (
                  <div className="p-4 bg-[#FAF8F5] border border-border/40 rounded-2xl space-y-2">
                    {unassigned.length === 0 ? (
                      <p className="text-xs font-medium text-muted-foreground">Every hostel is already attached to a school.</p>
                    ) : (
                      unassigned.map((h) => (
                        <div key={h.id} className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-foreground">
                            {h.hostel_name} <span className="text-muted-foreground font-medium">· {h.location}</span>
                          </span>
                          <button
                            onClick={() => changeHostel(h.id, "assign")}
                            disabled={busyHostel === h.id}
                            className="h-8 px-4 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-[11px] rounded-full transition-colors cursor-pointer disabled:opacity-60"
                          >
                            Attach
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {hostels.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground">No hostels attached yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hostels.map((h) => {
                      const status = STATUS_LABEL[h.status];
                      return (
                        <div key={h.id} className="p-4 bg-card border border-border/40 rounded-[20px] shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80"
                              style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                              }}
                            />
                            <div>
                              <h4 className="font-extrabold text-[15px] text-foreground">{h.hostel_name}</h4>
                              <p className="text-[12px] text-muted-foreground font-medium">
                                {h.distance_from_campus != null ? `${h.distance_from_campus} km · ` : ""}{h.beds} beds
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              status === 'Live' ? 'bg-emerald-500/10 text-emerald-600' :
                              status === 'Pending' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-gray-500/10 text-gray-500'
                            }`}>
                              {status}
                            </span>
                            <button
                              onClick={() => changeHostel(h.id, "unassign")}
                              disabled={busyHostel === h.id}
                              aria-label={`Detach ${h.hostel_name}`}
                              className="w-7 h-7 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground cursor-pointer disabled:opacity-60"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {editing && selected && (
        <Modal title={`Edit ${selected.name}`} onClose={() => setEditing(false)}>
          <form onSubmit={saveEdit} className="space-y-4">
            {([["name", "Name"], ["location", "Location"], ["email_domain", "Student email domain"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <label htmlFor={`sch-${k}`} className="text-xs font-bold text-foreground">{label}</label>
                <input id={`sch-${k}`} required value={editForm[k]} onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })} className={inputClass} />
              </div>
            ))}
            {editError && <p role="alert" className="text-[12px] font-bold text-red-600">{editError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="h-11 px-6 rounded-full border border-border font-bold text-sm cursor-pointer">Cancel</button>
              <button type="submit" disabled={savingEdit} className="h-11 px-6 rounded-full bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold text-sm disabled:opacity-60 cursor-pointer">{savingEdit ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Modal>
      )}
      {confirmDelete && selected && (
        <ConfirmDialog
          title={`Delete ${selected.name}?`}
          description={selected.hostel_count > 0 ? `Its ${selected.hostel_count} hostel${selected.hostel_count === 1 ? "" : "s"} stay live but will no longer belong to any school. This can't be undone.` : "This school has no hostels. This can't be undone."}
          confirmLabel="Delete school"
          onConfirm={async () => { await deleteSchool(selected.id); toast(`${selected.name} was deleted.`); setSelectedId(null); await loadSchools(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
