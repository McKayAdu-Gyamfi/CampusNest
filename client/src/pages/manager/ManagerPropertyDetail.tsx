import { useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/routes";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Wifi, Wind, WashingMachine, Utensils, BookOpen, Pencil, ChevronLeft, Check, Plus, Lock } from "lucide-react";
import { errorMessage } from "@/lib/adminApi";
import { AMENITY_OPTIONS, ROOM_TYPES, addManagerRoom, getManagerHostel, saveManagerHostel, updateRoomSize, type ManagerHostel } from "@/lib/managerHostels";

interface Draft {
  name: string; location: string; desc: string;
  standardPrice: number; sharedPrice: number; amenities: string[];
}

const ICONS = { WiFi: Wifi, AC: Wind, Laundry: WashingMachine, Kitchen: Utensils, StudyDesk: BookOpen } as const;

const inputCls =
  "w-full bg-[#F8F6F3] border border-[#E5E0D8] rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[#463C38] focus:outline-none focus:ring-2 focus:ring-[#A84A1A]/20";

export default function ManagerPropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState<ManagerHostel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [params] = useSearchParams();
  const [addingRoom, setAddingRoom] = useState(params.get("addRoom") === "1");
  const EMPTY_ROOM = { number: "", type: "DOUBLE", price: "", capacity: "2", length: "", width: "", height: "" };
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);
  const [sizeEdit, setSizeEdit] = useState<{ id: string; length: string; width: string; height: string } | null>(null);
  const [sizeSaving, setSizeSaving] = useState(false);
  const [roomSaving, setRoomSaving] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const roomsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (addingRoom && property) roomsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // only when the page first loads with ?addRoom=1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  useEffect(() => {
    if (!id) return;
    getManagerHostel(id).then(setProperty).catch((e) => setLoadError(errorMessage(e)));
  }, [id]);

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0EFEA] gap-3">
        <p className="font-bold text-[#463C38]">{loadError ?? "Loading…"}</p>
        {loadError && <Link to={ROUTES.manager.properties} className="text-[#A84A1A] font-bold">Back to my properties</Link>}
      </div>
    );
  }

  const editing = draft !== null;
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  // Photos are read-only for managers: they always show what is on the listing.
  const photos = property.images.map((i) => i.url);
  const view = draft
    ? { ...draft, photos }
    : {
        name: property.name, location: property.location, desc: property.desc,
        standardPrice: property.standardPrice, sharedPrice: property.sharedPrice,
        amenities: property.amenities, photos,
      };

  const submitRoom = async () => {
    const price = Number(roomForm.price.replace(/[^\d.]/g, ""));
    const capacity = Number(roomForm.capacity);
    if (!roomForm.number.trim()) { setRoomError("Enter a room number."); return; }
    if (!(price > 0)) { setRoomError("Enter a price greater than 0."); return; }
    if (!Number.isInteger(capacity) || capacity < 1) { setRoomError("Capacity must be at least 1."); return; }
    const dim = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const length = dim(roomForm.length), width = dim(roomForm.width), height = dim(roomForm.height);
    if ([length, width, height].some((d) => d !== undefined && !(d > 0))) { setRoomError("Room dimensions must be numbers greater than 0 (metres)."); return; }
    if ((length === undefined) !== (width === undefined)) { setRoomError("Enter both length and width, or leave both empty."); return; }
    setRoomSaving(true); setRoomError(null);
    try {
      setProperty(await addManagerRoom(property.id, { number: roomForm.number.trim(), type: roomForm.type, price, capacity, length, width, height }));
      setRoomForm(EMPTY_ROOM);
      setAddingRoom(false);
    } catch (e) {
      setRoomError(errorMessage(e));
    } finally {
      setRoomSaving(false);
    }
  };

  const saveSize = async () => {
    if (!sizeEdit) return;
    const [length, width, height] = [sizeEdit.length, sizeEdit.width, sizeEdit.height].map(Number);
    if (![length, width, height].every((d) => d > 0)) { setRoomError("Enter length, width and height as numbers greater than 0 (metres)."); return; }
    setSizeSaving(true); setRoomError(null);
    try {
      setProperty(await updateRoomSize(property.id, sizeEdit.id, { length, width, height }));
      setSizeEdit(null);
    } catch (e) {
      setRoomError(errorMessage(e));
    } finally {
      setSizeSaving(false);
    }
  };

  const startEdit = () => {
    setSaved(false); setSaveError(null);
    setDraft({
      name: property.name, location: property.location, desc: property.desc,
      standardPrice: property.standardPrice, sharedPrice: property.sharedPrice,
      amenities: property.amenities,
    });
  };
  const cancel = () => setDraft(null);

  const commit = async () => {
    if (!draft) return;
    if (draft.standardPrice <= 0 || draft.sharedPrice <= 0) { setSaveError("Prices must be greater than 0."); return; }
    setSaving(true); setSaveError(null);
    try {
      const updated = await saveManagerHostel(property, {
        name: draft.name.trim() || property.name,
        location: draft.location.trim() || property.location,
        desc: draft.desc,
        standardPrice: draft.standardPrice,
        sharedPrice: draft.sharedPrice,
        amenities: draft.amenities,
      });
      setProperty(updated);
      setDraft(null);
      setSaved(true);
    } catch (e) {
      setSaveError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (key: string) =>
    setDraft((d) => d && ({
      ...d,
      amenities: d.amenities.includes(key) ? d.amenities.filter((a) => a !== key) : [...d.amenities, key],
    }));

  const setPrice = (field: "standardPrice" | "sharedPrice", raw: string) =>
    patch({ [field]: Number(raw.replace(/[^\d]/g, "")) || 0 });

  const pricing = [
    { field: "standardPrice" as const, type: "Standard room", details: "per semester" },
    { field: "sharedPrice" as const, type: "Shared room", details: "per semester · starting price" },
  ];

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F0EFEA] pb-20">
      {/* Header */}
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 flex items-center justify-between gap-4 border-b border-solid border-[#E5D0BA]/50 mb-6">
        <div className="flex items-center space-x-3 min-w-0">
          <Link to={ROUTES.manager.properties} className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-[#463C38] hover:bg-[#F8F6F3] shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl lg:text-[22px] font-bold text-[#463C38] truncate">{property.name}</h1>
        </div>
        {editing ? (
          <div className="flex items-center space-x-2 shrink-0">
            <button onClick={cancel} disabled={saving} className="border border-[#E5E0D8] bg-white text-[#5C4538] px-5 py-2.5 rounded-full font-bold text-sm hover:bg-[#F8F6F3]">Cancel</button>
            <button onClick={commit} disabled={saving} className="bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-60 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-sm">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        ) : (
          <div className="flex items-center space-x-3 shrink-0">
            <NotificationsDropdown />
            <button onClick={startEdit} className="bg-[#A84A1A] hover:bg-[#8F3E15] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-sm flex items-center space-x-2">
              <Pencil className="w-3.5 h-3.5" /><span>Edit hostel details</span>
            </button>
          </div>
        )}
      </div>

      <div className="px-5 lg:px-8 space-y-4 w-full">
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-[13px] font-bold">{saveError}</div>
        )}
        {saved && !editing && (
          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-[13px] font-bold">
            <Check className="w-4 h-4" /><span>Changes saved.</span>
          </div>
        )}

        {/* Cover & details */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-full sm:w-[220px] h-36 rounded-xl bg-[#E5D0BA] relative shrink-0 overflow-hidden">
              {view.photos[0] && <img src={view.photos[0]} alt={view.name} className="absolute inset-0 w-full h-full object-cover" />}
              <span className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest text-[#5C4538]">COVER</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Hostel name</label>
                    <input className={inputCls} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Location</label>
                    <input className={inputCls} value={draft.location} onChange={(e) => patch({ location: e.target.value })} />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-[20px] font-bold text-[#463C38] mb-1">{view.name}</h2>
                  <p className="text-[13px] font-medium text-[#8C8279]">{view.location} · {property.distance} km from campus</p>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Description</label>
            {editing ? (
              <textarea rows={4} className={`${inputCls} resize-none font-medium`} value={draft.desc} onChange={(e) => patch({ desc: e.target.value })} />
            ) : (
              <p className="text-[14px] font-medium text-[#5C4538] leading-relaxed">{view.desc}</p>
            )}
          </div>
        </div>

        {/* Photos (read-only for managers) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="mb-5">
            <h3 className="text-base font-bold text-[#463C38] mb-1">Photos</h3>
            <p className="text-[13px] font-medium text-[#8C8279] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {view.photos.length} photo{view.photos.length === 1 ? "" : "s"} on your listing. Photos are managed by KayaCampus: contact support to change them.
            </p>
          </div>
          {view.photos.length === 0 ? (
            <p className="text-[13px] font-medium text-[#8C8279]">No photos yet. Contact support and we'll add them for you.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {view.photos.map((src, i) => (
                <div key={`${i}-${src.slice(-24)}`} className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#E5D0BA]">
                  <img src={src} alt={`${view.name} ${i + 1}`} className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full">Cover</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-[#463C38] mb-1">Pricing per semester</h3>
            <p className="text-[13px] font-medium text-[#8C8279]">Set the price for each room type. Applies to new bookings.</p>
          </div>
          {pricing.map((room) => (
            <div key={room.field} className="flex justify-between items-center py-4 border-b border-[#F0EFEA] last:border-0">
              <div className="flex flex-col">
                <span className="font-bold text-[#463C38] text-[14px]">{room.type}</span>
                <span className="text-[12px] font-medium text-[#8C8279] mt-0.5">{room.details}</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-[#F8F6F3] px-3 py-1.5 rounded-lg text-[13px] font-bold text-[#8C8279]">GHS</span>
                {editing ? (
                  <input inputMode="numeric" className={`${inputCls} w-28 text-right`} value={draft[room.field]} onChange={(e) => setPrice(room.field, e.target.value)} />
                ) : (
                  <span className="font-bold text-[#463C38] text-[16px] w-[70px] text-right">{view[room.field].toLocaleString("en-GH")}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Amenities */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-[#463C38] mb-1">Amenities</h3>
            <p className="text-[13px] font-medium text-[#8C8279]">{editing ? "Tap to include. These show on your listing." : "These show on your listing."}</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {AMENITY_OPTIONS.map(({ key, label }) => {
              const Icon = ICONS[key];
              const active = view.amenities.includes(key);
              if (!editing && !active) return null;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!editing}
                  onClick={() => toggleAmenity(key)}
                  className={`flex items-center space-x-2 border px-4 py-2 rounded-full font-bold text-[13px] transition-colors ${
                    active ? "border-[#C8B09A] text-[#A84A1A] hover:bg-[#F1E8DC]/30" : "border-transparent text-[#8C8279] bg-[#F8F6F3] hover:bg-[#E5E0D8]"
                  } ${editing ? "cursor-pointer" : "cursor-default"}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Rooms */}
        <div ref={roomsRef} className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-[#463C38] mb-1">Rooms</h3>
              <p className="text-[13px] font-medium text-[#8C8279]">{property.rooms.length} rooms · new rooms appear on your listing straight away.</p>
            </div>
            {!addingRoom && (
              <button onClick={() => { setRoomError(null); setAddingRoom(true); }} className="flex items-center space-x-1.5 border border-[#E5E0D8] px-4 py-2 rounded-full text-[13px] font-bold text-[#A84A1A] hover:bg-[#F8F6F3] transition-colors cursor-pointer">
                <Plus className="w-4 h-4" /><span>Add room</span>
              </button>
            )}
          </div>

          {addingRoom && (
            <div className="bg-[#F8F6F3] rounded-xl p-4 mb-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Room number</label>
                  <input className={inputCls} placeholder="e.g. 412" value={roomForm.number} onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Room type</label>
                  <select
                    className={inputCls}
                    value={roomForm.type}
                    onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value, capacity: String(ROOM_TYPES.find((t) => t.value === e.target.value)?.capacity ?? 1) })}
                  >
                    {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Price per bed (GHS / semester)</label>
                  <input className={inputCls} inputMode="numeric" placeholder={String(property.standardPrice || "")} value={roomForm.price} onChange={(e) => setRoomForm({ ...roomForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Beds</label>
                  <input className={inputCls} inputMode="numeric" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value.replace(/\D/g, "") })} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-[#8C8279] mb-1.5">Room size in metres (optional)</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["length", "width", "height"] as const).map((d) => (
                    <input key={d} className={inputCls} inputMode="decimal" placeholder={d[0].toUpperCase() + d.slice(1)} value={roomForm[d]} onChange={(e) => setRoomForm({ ...roomForm, [d]: e.target.value.replace(/[^\d.]/g, "") })} />
                  ))}
                </div>
                <p className="text-[11px] font-medium text-[#8C8279] mt-1.5">Students see this as a floor plan on their booking.</p>
              </div>
              {roomError && <p className="text-[13px] font-bold text-red-600">{roomError}</p>}
              <div className="flex items-center space-x-2">
                <button onClick={submitRoom} disabled={roomSaving} className="bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-60 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-sm">{roomSaving ? "Adding…" : "Add room"}</button>
                <button onClick={() => { setAddingRoom(false); setRoomError(null); }} disabled={roomSaving} className="border border-[#E5E0D8] bg-white text-[#5C4538] px-5 py-2.5 rounded-full font-bold text-sm hover:bg-[#F8F6F3]">Cancel</button>
              </div>
            </div>
          )}

          {!addingRoom && roomError && <p className="text-[13px] font-bold text-red-600 mb-3">{roomError}</p>}
          <div className="divide-y divide-[#F0EFEA]">
            {property.rooms.map((r) => (
              <div key={r.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-bold text-[#463C38] text-[14px]">Room {r.number}</span>
                    <span className="text-[12px] font-medium text-[#8C8279] mt-0.5">
                      {ROOM_TYPES.find((t) => t.value === r.type)?.label ?? r.type} · {r.occupancy}/{r.capacity} beds filled
                      {r.length && r.width ? ` · ${r.length} × ${r.width}${r.height ? ` × ${r.height}` : ""} m` : " · size not set"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-[#463C38] text-[14px]">GHS {r.price.toLocaleString("en-GH")}</span>
                    <button
                      onClick={() => { setRoomError(null); setSizeEdit(sizeEdit?.id === r.id ? null : { id: r.id, length: String(r.length ?? ""), width: String(r.width ?? ""), height: String(r.height ?? "") }); }}
                      className="border border-[#E5E0D8] px-3 py-1.5 rounded-full text-[12px] font-bold text-[#A84A1A] hover:bg-[#F8F6F3] transition-colors"
                    >
                      {r.length && r.width ? "Edit size" : "Set size"}
                    </button>
                  </div>
                </div>
                {sizeEdit?.id === r.id && (
                  <div className="mt-3 bg-[#F8F6F3] rounded-xl p-3 flex flex-wrap items-center gap-3">
                    {(["length", "width", "height"] as const).map((d) => (
                      <div key={d} className="flex items-center space-x-1.5">
                        <label className="text-[11px] font-bold text-[#8C8279] capitalize">{d}</label>
                        <input className={`${inputCls} w-20`} inputMode="decimal" value={sizeEdit[d]} onChange={(e) => setSizeEdit({ ...sizeEdit, [d]: e.target.value.replace(/[^\d.]/g, "") })} />
                        <span className="text-[11px] font-bold text-[#8C8279]">m</span>
                      </div>
                    ))}
                    <button onClick={saveSize} disabled={sizeSaving} className="bg-[#A84A1A] hover:bg-[#8F3E15] disabled:opacity-60 text-white px-4 py-2 rounded-full font-bold text-[12px]">{sizeSaving ? "Saving…" : "Save size"}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
