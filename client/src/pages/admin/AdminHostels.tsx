import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Box, Check, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import {
  errorMessage, listAdminHostels, removeHostelPhoto, setHostelStatus, uploadHostelPhotos,
  type AdminHostel, type HostelStatus,
} from "@/lib/adminApi";
import { ROUTES } from "@/lib/routes";
import { Chip, DetailRow, EmptyState, ErrorBanner, Modal, PageHeader, ReasonDialog, SearchBox, Spinner, Tabs } from "@/components/admin/AdminUI";
import { useToast } from "@/components/ui/toaster";

type Filter = "ALL" | HostelStatus;
const STATUS: Record<HostelStatus, { label: string; tone: "green" | "amber" | "red" }> = {
  APPROVED: { label: "Live", tone: "green" },
  PENDING: { label: "Awaiting approval", tone: "amber" },
  REJECTED: { label: "Rejected", tone: "red" },
};
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function AdminHostels() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [hostels, setHostels] = useState<AdminHostel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(params.get("focus"));
  const [rejecting, setRejecting] = useState<AdminHostel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filter = (["PENDING", "APPROVED", "REJECTED"].includes(params.get("status") ?? "") ? params.get("status") : "ALL") as Filter;
  const setFilter = (f: Filter) => setParams(f === "ALL" ? {} : { status: f }, { replace: true });

  const load = useCallback(() => {
    listAdminHostels().then((rows) => { setHostels(rows); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const counts = useMemo(() => {
    const all = hostels ?? [];
    return { ALL: all.length, PENDING: all.filter((h) => h.status === "PENDING").length, APPROVED: all.filter((h) => h.status === "APPROVED").length, REJECTED: all.filter((h) => h.status === "REJECTED").length };
  }, [hostels]);

  const shown = (hostels ?? []).filter((h) => {
    if (filter !== "ALL" && h.status !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [h.hostel_name, h.location, h.manager?.name, h.manager?.email, h.school?.name].some((v) => v?.toLowerCase().includes(q));
  });
  const open = hostels?.find((h) => h.id === openId) ?? null;

  const decide = async (h: AdminHostel, status: HostelStatus, reason?: string) => {
    setBusyId(h.id);
    try {
      await setHostelStatus(h.id, status, reason);
      toast(status === "APPROVED" ? `${h.hostel_name} is now live.` : status === "REJECTED" ? `${h.hostel_name} was rejected.` : `${h.hostel_name} moved back to pending.`);
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
      throw e;
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hostels"
        subtitle={hostels ? `${counts.PENDING} awaiting approval · ${counts.APPROVED} live · ${counts.REJECTED} rejected` : "Loading…"}
        actions={<SearchBox value={query} onChange={setQuery} placeholder="Search hostel, manager, school…" />}
      />
      <ErrorBanner message={error} />

      <Tabs
        active={filter} onChange={setFilter}
        tabs={[
          { id: "ALL", label: "All", count: counts.ALL },
          { id: "PENDING", label: "Awaiting approval", count: counts.PENDING },
          { id: "APPROVED", label: "Live", count: counts.APPROVED },
          { id: "REJECTED", label: "Rejected", count: counts.REJECTED },
        ]}
      />

      {!hostels && !error && <Spinner />}
      {hostels && shown.length === 0 && (
        <EmptyState
          title={filter === "PENDING" ? "Nothing waiting for review" : "No hostels match"}
          text={filter === "PENDING" ? "New hostels from managers appear here for approval." : "Try another filter or search."}
        />
      )}

      <ul className="space-y-3">
        {shown.map((h) => (
          <li key={h.id} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
            <button onClick={() => setOpenId(h.id)} className="flex items-center gap-4 flex-1 min-w-0 text-left cursor-pointer">
              <div className="w-20 h-20 rounded-xl bg-muted overflow-hidden shrink-0">
                {h.images[0] ? <img src={h.images[0].url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-muted-foreground text-center px-1">No photos</div>}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-[16px] text-foreground truncate">{h.hostel_name}</h3>
                  <Chip tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Chip>
                </div>
                <p className="text-[13px] text-muted-foreground font-medium truncate">{h.location}{h.school ? ` · ${h.school.name}` : ""}</p>
                <p className="text-[12px] text-muted-foreground font-medium mt-1 truncate">
                  {h.manager ? `${h.manager.name} · ${h.manager.email}` : "No manager"} · {h.rooms_total} rooms · {h.beds_filled}/{h.beds_total} beds
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {h.status === "PENDING" && (
                <>
                  <button disabled={busyId === h.id} onClick={() => decide(h, "APPROVED").catch(() => undefined)} className="h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer">
                    {busyId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Approve
                  </button>
                  <button onClick={() => setRejecting(h)} className="h-10 px-5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"><X className="w-3.5 h-3.5" />Reject</button>
                </>
              )}
              <button onClick={() => setOpenId(h.id)} className="h-10 px-5 rounded-full bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs cursor-pointer">Details</button>
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <HostelDetail
          hostel={open} busy={busyId === open.id}
          onClose={() => { setOpenId(null); if (params.get("focus")) { const p = new URLSearchParams(params); p.delete("focus"); setParams(p, { replace: true }); } }}
          onApprove={() => decide(open, "APPROVED").catch(() => undefined)}
          onReject={() => setRejecting(open)}
          onPending={() => decide(open, "PENDING").catch(() => undefined)}
          onChanged={load}
        />
      )}

      {rejecting && (
        <ReasonDialog
          title={`Reject ${rejecting.hostel_name}?`}
          description="The manager is notified and sees this reason, so tell them what to fix."
          confirmLabel="Reject hostel" required minLength={5}
          onConfirm={(reason) => decide(rejecting, "REJECTED", reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </div>
  );
}

function HostelDetail({ hostel: h, busy, onClose, onApprove, onReject, onPending, onChanged }: {
  hostel: AdminHostel; busy: boolean; onClose: () => void; onApprove: () => void; onReject: () => void; onPending: () => void; onChanged: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files);
    const bad = picked.find((f) => !["image/jpeg", "image/png"].includes(f.type) || f.size > MAX_PHOTO_BYTES);
    if (bad) { toast(`${bad.name}: only JPEG or PNG photos up to 10 MB are allowed.`, "error"); return; }
    setUploading(true);
    try { await uploadHostelPhotos(h.id, picked); toast(`${picked.length} photo${picked.length === 1 ? "" : "s"} added.`); onChanged(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const remove = async (imageId: string) => {
    setRemoving(imageId);
    try { await removeHostelPhoto(h.id, imageId); toast("Photo removed."); onChanged(); }
    catch (e) { toast(errorMessage(e), "error"); }
    finally { setRemoving(null); }
  };


  return (
    <Modal title={h.hostel_name} onClose={onClose} wide>
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Chip tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Chip>
          <span className="text-[13px] text-muted-foreground font-medium">Submitted {fmtDate(h.created_at)}</span>
        </div>

        {h.status_reason && (
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-[13px]">
            <p className="font-extrabold text-foreground">{h.status === "REJECTED" ? "Rejected" : "Last decision"}{h.reviewed_by_name ? ` by ${h.reviewed_by_name}` : ""} on {fmtDate(h.reviewed_at)}</p>
            <p className="font-medium text-muted-foreground mt-1">{h.status_reason}</p>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-extrabold text-foreground">Photos ({h.images.length})</h3>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="h-9 px-4 rounded-full border border-border text-[#C56A30] font-bold text-xs flex items-center gap-1.5 hover:bg-accent disabled:opacity-60 cursor-pointer">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}Add photos
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => upload(e.target.files)} />
          </div>
          {h.images.length === 0 ? (
            <p className="text-[13px] font-medium text-muted-foreground">No photos yet. A hostel should have photos before it goes live.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {h.images.map((img, i) => (
                <div key={img.id} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted group">
                  <img src={img.url} alt={`${h.hostel_name} ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full">Cover</span>}
                  <button onClick={() => remove(img.id)} disabled={removing === img.id} aria-label="Remove photo" className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/65 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer">
                    {removing === img.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <DetailRow label="Location" value={h.location} />
          <DetailRow label="Distance from campus" value={h.distance_from_campus !== undefined ? `${h.distance_from_campus} km` : ""} />
          <DetailRow label="School" value={h.school?.name} />
          <DetailRow label="Rooms and beds" value={`${h.rooms_total} rooms · ${h.beds_filled}/${h.beds_total} beds taken`} />
          <div className="sm:col-span-2"><DetailRow label="Description" value={h.description} /></div>
        </dl>

        <section>
          <h3 className="text-[14px] font-extrabold text-foreground mb-3">Manager</h3>
          {h.manager ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border p-4">
              <DetailRow label="Name" value={h.manager.name} />
              <DetailRow label="Business" value={h.manager.business_name} />
              <DetailRow label="Email" value={<a href={`mailto:${h.manager.email}`} className="text-[#C56A30] hover:underline">{h.manager.email}</a>} />
              <DetailRow label="Phone" value={h.manager.phone} />
            </dl>
          ) : <p className="text-[13px] font-medium text-muted-foreground">This hostel has no manager assigned.</p>}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/50">
          <Link to={`${ROUTES.admin.roomTours}?hostel=${h.id}`} className="h-10 px-5 rounded-full border border-border font-bold text-xs flex items-center gap-2 hover:bg-accent"><Box className="w-4 h-4" />Room tours</Link>
          <div className="flex items-center gap-2 flex-wrap">
            {h.status !== "APPROVED" && <button disabled={busy} onClick={onApprove} className="h-10 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold text-xs cursor-pointer">Approve</button>}
            {h.status !== "REJECTED" && <button onClick={onReject} className="h-10 px-5 rounded-full border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 font-extrabold text-xs cursor-pointer">Reject</button>}
            {h.status === "APPROVED" && <button disabled={busy} onClick={onPending} className="h-10 px-5 rounded-full border border-border font-extrabold text-xs hover:bg-accent disabled:opacity-60 cursor-pointer">Take offline (back to pending)</button>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
