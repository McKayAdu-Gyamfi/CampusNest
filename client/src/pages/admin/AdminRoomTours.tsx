import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, ImagePlus, Loader2, Play, Trash2 } from "lucide-react";
import {
  addTourScene, deleteTourScene, errorMessage, getRoomScenes, listAdminHostels, listRooms,
  type AdminHostel, type AdminRoom, type TourScene,
} from "@/lib/adminApi";
import { buildTourConfig, checkPanorama } from "@/lib/roomTour";
import { Chip, ConfirmDialog, EmptyState, ErrorBanner, Modal, PageHeader, Spinner } from "@/components/admin/AdminUI";
import { useToast } from "@/components/ui/toaster";

/** Create and manage the 360° tour for each room: upload panoramas, preview, delete. */
export default function AdminRoomTours() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [hostels, setHostels] = useState<AdminHostel[] | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<TourScene[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileNote, setFileNote] = useState<{ error?: string; warning?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<TourScene | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hostelId = params.get("hostel") ?? hostels?.[0]?.id ?? "";
  const room = rooms?.find((r) => r.id === roomId) ?? null;

  useEffect(() => { listAdminHostels().then(setHostels).catch((e) => setError(errorMessage(e))); }, []);

  const loadRooms = useCallback(async (h: string) => {
    try { const r = await listRooms(h); setRooms(r); setRoomId((cur) => (cur && r.some((x) => x.id === cur) ? cur : r[0]?.id ?? null)); setError(null); }
    catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => { if (hostelId) { setRooms(null); const t = setTimeout(() => loadRooms(hostelId), 0); return () => clearTimeout(t); } }, [hostelId, loadRooms]);

  useEffect(() => {
    if (!roomId) { const t = setTimeout(() => setScenes([]), 0); return () => clearTimeout(t); }
    let cancelled = false;
    const t = setTimeout(() => { setScenes(null); getRoomScenes(roomId).then((s) => { if (!cancelled) setScenes(s); }).catch((e) => { if (!cancelled) setError(errorMessage(e)); }); }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [roomId]);

  const pick = async (f: File | null) => {
    setFile(f); setFileNote(null);
    if (!f) return;
    const check = await checkPanorama(f);
    setFileNote(check);
    if (check.error) setFile(null);
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !file || !name.trim()) return;
    setUploading(true);
    try {
      await addTourScene(roomId, name.trim(), file);
      toast(`Scene "${name.trim()}" added.`);
      setName(""); setFile(null); setFileNote(null); if (fileRef.current) fileRef.current.value = "";
      const [s] = await Promise.all([getRoomScenes(roomId), loadRooms(hostelId)]);
      setScenes(s);
    } catch (err) { toast(errorMessage(err), "error"); }
    finally { setUploading(false); }
  };

  const withTours = (rooms ?? []).filter((r) => r.tour_scene_count > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Room tours" subtitle={rooms ? `${withTours} of ${rooms.length} rooms have a 360° tour` : "Choose a hostel"} />
      <ErrorBanner message={error} />

      <div className="flex items-center gap-3 flex-wrap">
        <label htmlFor="tour-hostel" className="text-[13px] font-bold text-muted-foreground">Hostel</label>
        <select id="tour-hostel" value={hostelId} onChange={(e) => setParams({ hostel: e.target.value }, { replace: true })} className="h-11 px-4 rounded-full bg-card border border-border/60 text-[14px] font-bold min-w-56">
          {(hostels ?? []).map((h) => <option key={h.id} value={h.id}>{h.hostel_name}</option>)}
        </select>
      </div>

      {hostels && hostels.length === 0 && <EmptyState title="No hostels yet" text="Tours belong to rooms, and rooms belong to hostels." />}
      {hostelId && !rooms && !error && <Spinner />}
      {rooms && rooms.length === 0 && <EmptyState title="This hostel has no rooms yet" text="The manager adds rooms from their property page. Then you can add tours here." />}

      {rooms && rooms.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
          <div className="space-y-2" role="listbox" aria-label="Rooms">
            <h2 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-1">Rooms</h2>
            {rooms.map((r) => (
              <button key={r.id} role="option" aria-selected={roomId === r.id} onClick={() => setRoomId(r.id)} className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${roomId === r.id ? "bg-[#FAF0E6] dark:bg-[#C56A30]/15 border-[#C56A30]/40 shadow-sm" : "bg-card border-border/40 hover:bg-accent/40"}`}>
                <span><span className="block font-extrabold text-[14px] text-foreground">Room {r.room_number}</span><span className="block text-[12px] text-muted-foreground font-medium">{r.room_type} · {r.capacity} beds</span></span>
                {r.tour_scene_count > 0 ? <Chip tone="green">{r.tour_scene_count} scene{r.tour_scene_count === 1 ? "" : "s"}</Chip> : <Chip>No tour</Chip>}
              </button>
            ))}
          </div>

          {room && (
            <div className="space-y-6">
              <section className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-[18px] font-extrabold text-foreground">Room {room.room_number}: scenes</h2>
                  <button disabled={!scenes?.length} onClick={() => setPreviewing(true)} className="h-10 px-5 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer"><Play className="w-4 h-4" />Preview tour</button>
                </div>
                {!scenes && <Spinner />}
                {scenes && scenes.length === 0 && <p className="text-[13px] font-medium text-muted-foreground">No scenes yet. Students see the sample tour until you add one.</p>}
                <ul className="space-y-2">
                  {scenes?.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3">
                      <span className="w-8 h-8 rounded-lg bg-[#FAF0E6] dark:bg-[#C56A30]/15 text-[#C56A30] flex items-center justify-center shrink-0"><Box className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0"><span className="block font-bold text-[14px] text-foreground truncate">{s.scene_name}</span><span className="block text-[11px] text-muted-foreground font-medium">Scene {i + 1}{i === 0 ? " · opens first" : ""}</span></span>
                      <button onClick={() => setDeleting(s)} aria-label={`Delete ${s.scene_name}`} className="w-9 h-9 rounded-full border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              </section>

              <form onSubmit={upload} className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-[18px] font-extrabold text-foreground">Add a scene</h2>
                <div>
                  <label htmlFor="scene-name" className="text-[12px] font-bold block mb-1.5">Scene name</label>
                  <input id="scene-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Bedroom, Ensuite bath" className="w-full h-11 px-4 rounded-xl border border-border bg-background text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#C56A30]/40" />
                </div>
                <div>
                  <span className="text-[12px] font-bold block mb-1.5">360° panorama</span>
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-border hover:border-[#C56A30]/60 hover:bg-accent/30 transition-colors p-6 flex flex-col items-center gap-1.5 cursor-pointer text-center">
                    <ImagePlus className="w-6 h-6 text-[#C56A30]" />
                    <span className="text-[14px] font-bold text-foreground">{file ? file.name : "Choose a panorama"}</span>
                    <span className="text-[12px] font-medium text-muted-foreground">Equirectangular JPEG or PNG, 2:1, up to 20 MB (4096×2048 or larger is best)</span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
                  {fileNote?.error && <p role="alert" className="text-[12px] font-bold text-red-600 mt-2">{fileNote.error}</p>}
                  {fileNote?.warning && <p className="text-[12px] font-bold text-amber-600 mt-2">{fileNote.warning}</p>}
                </div>
                <button type="submit" disabled={uploading || !file || !name.trim()} className="h-11 px-6 rounded-full bg-[#C56A30] hover:bg-[#b05b26] disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 cursor-pointer">
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}{uploading ? "Uploading and processing…" : "Add scene"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {deleting && roomId && (
        <ConfirmDialog
          title={`Delete "${deleting.scene_name}"?`} description="Students will no longer see this view. This can't be undone." confirmLabel="Delete scene"
          onConfirm={async () => { await deleteTourScene(roomId, deleting.id); toast("Scene deleted."); setScenes(await getRoomScenes(roomId)); await loadRooms(hostelId); }}
          onClose={() => setDeleting(null)}
        />
      )}
      {previewing && scenes && <TourPreview scenes={scenes} onClose={() => setPreviewing(false)} />}
    </div>
  );
}

function TourPreview({ scenes, onClose }: { scenes: TourScene[]; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const configRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildTourConfig(scenes).then((c) => { if (cancelled) return; configRef.current = c; setState(c ? "ready" : "failed"); });
    return () => { cancelled = true; };
  }, [scenes]);

  return (
    <Modal title="Tour preview" onClose={onClose} wide>
      {state === "loading" && <Spinner label="Loading scenes…" />}
      {state === "failed" && <ErrorBanner message="The scenes couldn't be loaded. Try again in a moment." />}
      {state === "ready" && (
        <iframe
          ref={iframeRef} title="360° tour preview" src="/tour.html" className="w-full h-[60dvh] rounded-xl bg-black border-0"
          onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: "pannellum_config", config: configRef.current }, "*")}
        />
      )}
    </Modal>
  );
}
