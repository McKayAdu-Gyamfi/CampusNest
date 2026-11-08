import { useEffect, useState } from "react";
import { ROUTES } from "@/lib/routes";
import HelpDesk from "@/components/HelpDesk";
import HostelReviews from "@/components/HostelReviews";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, CalendarDays, MapPin, Navigation, Receipt, Rotate3d, Ruler, Users } from "lucide-react";
import { useBookings } from "@/contexts/BookingContext";
import { useToast } from "@/components/ui/toaster";
import { apiFetch } from "@/lib/apiClient";
import { AMENITY_LABELS } from "@/lib/hostels";
import { errorMessage } from "@/lib/adminApi";

interface RoomDetail {
  room_number: string;
  room_type: string;
  capacity: number;
  current_occupancy: number;
  price_per_bed: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  ROOM_IMAGE_URLS: { image_url: string }[];
  ROOM_AMENITY: { name: string }[];
}
interface HostelDetail {
  description?: string;
  HOSTEL_IMAGE_URLS: { image_url: string }[];
  HOSTEL_AMENITY: { name: string }[];
}

const STATUS_STYLE = {
  CONFIRMED: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  CHECKED_OUT: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  PENDING: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  CANCELLED: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
} as const;

const STATUS_NOTE = {
  PENDING: "Your payment went through. The hostel manager still needs to approve this booking.",
  CONFIRMED: "Approved. Your room is secured.",
  CHECKED_OUT: "This stay is complete.",
  CANCELLED: "This booking was cancelled.",
} as const;

export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { bookings, isLoading, cancelBooking } = useBookings();
  const booking = bookings.find((b) => b.id === id);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [hostel, setHostel] = useState<HostelDetail | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  const roomId = booking?.roomId;
  const hostelId = booking?.hostelId;
  useEffect(() => {
    if (!roomId) return;
    apiFetch<RoomDetail>(`/rooms/${roomId}`).then(setRoom).catch(() => setRoom(null));
  }, [roomId]);
  useEffect(() => {
    if (!hostelId) return;
    apiFetch<HostelDetail>(`/hostels/${hostelId}`).then(setHostel).catch(() => setHostel(null));
  }, [hostelId]);

  if (!booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F0EFEA] dark:bg-background gap-3">
        <p className="font-bold text-foreground">{isLoading ? "Loading…" : "Booking not found."}</p>
        {!isLoading && <Link to={ROUTES.student.bookings} className="text-[#A84A1A] font-bold">Back to my bookings</Link>}
      </div>
    );
  }

  // Room photos first, then the hostel's, then the cover image.
  const photos = [
    ...(room?.ROOM_IMAGE_URLS.map((i) => i.image_url) ?? []),
    ...(hostel?.HOSTEL_IMAGE_URLS.map((i) => i.image_url) ?? []),
  ];
  if (photos.length === 0 && booking.image) photos.push(booking.image);

  const amenityNames = [
    ...(room?.ROOM_AMENITY.map((a) => a.name) ?? []),
    ...(hostel?.HOSTEL_AMENITY.map((a) => a.name) ?? []),
  ];
  const amenities = Array.from(new Set(amenityNames.map((n) => AMENITY_LABELS[n]).filter(Boolean)));

  const hasSize = !!(room && room.length && room.width);
  const area = hasSize ? Number((room!.length! * room!.width!).toFixed(1)) : null;
  const dims = hasSize ? `${area} m²` : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.hostelName} ${booking.location}`.trim())}`;
  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED";

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking? This can't be undone.")) return;
    setCancelling(true);
    try {
      await cancelBooking(booking.id);
      toast("Booking cancelled.", "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setCancelling(false);
    }
  };

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-3 border-b border-[#F0EFEA] dark:border-border/40 last:border-0">
      <span className="text-[13px] font-medium text-[#8C8279] dark:text-muted-foreground">{label}</span>
      <span className="text-[14px] font-bold text-[#463C38] dark:text-foreground text-right">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#F0EFEA] dark:bg-background pb-24">
      <div className="px-5 lg:px-10 pt-8 pb-5 flex items-center space-x-4">
        <button
          onClick={() => navigate(ROUTES.student.bookings)}
          aria-label="Back to my bookings"
          className="w-10 h-10 bg-card rounded-full flex items-center justify-center shadow-sm border border-border/40 text-foreground hover:bg-accent transition-colors shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-[#463C38] dark:text-foreground truncate">{booking.hostelName} · Room {booking.roomNumber.replace(/^Rm\s*/, "")}</h1>
          <p className="text-[13px] font-medium text-[#8C8279] dark:text-muted-foreground">Ref {booking.reference}</p>
        </div>
      </div>

      <div className="px-5 lg:px-10 grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
        {/* Left: photos + room info */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            <div className="aspect-[16/9] bg-[#E5D0BA] relative">
              {photos[activePhoto] && <img src={photos[activePhoto]} alt={booking.hostelName} className="absolute inset-0 w-full h-full object-cover" />}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto hide-scrollbar">
                {photos.map((src, i) => (
                  <button
                    key={`${i}-${src.slice(-20)}`}
                    onClick={() => setActivePhoto(i)}
                    className={`w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-colors ${i === activePhoto ? "border-[#A84A1A]" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-4">Your room</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { icon: BedDouble, label: "Type", value: booking.roomLabel },
                                { icon: Ruler, label: "Size", value: dims ?? "Not set" },
                { icon: MapPin, label: "Room no.", value: booking.roomNumber.replace(/^Rm\s*/, "") || "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-[#F8F6F3] dark:bg-muted/30 rounded-xl p-3">
                  <Icon className="w-4 h-4 text-[#A84A1A] mb-2" />
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A29A91] dark:text-muted-foreground">{label}</p>
                  <p className="text-[13px] font-bold text-foreground mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {room && (() => {
              const total = room.capacity;
              const taken = Math.min(room.current_occupancy, total);
              const free = total - taken;
              return (
                <div className="bg-[#F8F6F3] dark:bg-muted/30 rounded-xl p-4 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-[#A84A1A]" />
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A29A91] dark:text-muted-foreground">Beds in this room</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${free === 0 ? "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"}`}>
                      {free === 0 ? "Full" : `${free} free`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Array.from({ length: total }, (_, i) => {
                      const isTaken = i < taken;
                      return (
                        <div
                          key={i}
                          title={isTaken ? "Taken" : "Available"}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-colors ${
                            isTaken ? "bg-[#A84A1A] border-[#A84A1A] text-white" : "bg-transparent border-dashed border-[#C8B09A] text-[#C8B09A]"
                          }`}
                        >
                          <BedDouble className="w-5 h-5" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="h-1.5 bg-[#E5E0D8] dark:bg-border/40 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#A84A1A] rounded-full transition-all" style={{ width: `${total ? (taken / total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground">
                    <span className="font-bold text-foreground">{taken} of {total}</span> beds taken
                  </p>
                </div>
              );
            })()}

            {room && (
              <div className="mb-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A29A91] dark:text-muted-foreground mb-2">Room view</p>
                <button
                  onClick={() =>
                    navigate(ROUTES.student.tour, {
                      state: {
                        // LivePreview's close button comes back here.
                        returnPath: ROUTES.student.booking(booking.id),
                        returnToHostel: booking.hostelId,
                        hostelName: booking.hostelName,
                        location: booking.location,
                        image: booking.image,
                        roomLabel: booking.roomLabel,
                        price: booking.price,
                      },
                    })
                  }
                  className="group w-full relative rounded-xl overflow-hidden aspect-[16/7] bg-[#E5D0BA] text-left cursor-pointer"
                >
                  {(photos[0] || booking.image) && (
                    <img src={photos[0] || booking.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <span className="w-14 h-14 rounded-full bg-white/90 text-[#A84A1A] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Rotate3d className="w-7 h-7" />
                    </span>
                    <span className="mt-3 text-[14px] font-extrabold tracking-tight">Take the 360° tour</span>
                    <span className="text-[11px] font-medium text-white/80">Look around your room before move-in</span>
                  </div>
                </button>
              </div>
            )}

            {amenities.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#A29A91] dark:text-muted-foreground mb-2">Included</p>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <span key={a} className="px-3 py-1.5 rounded-full bg-[#F1E8DC] dark:bg-card text-[#A84A1A] text-[12px] font-bold">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {hostel?.description && (
              <p className="text-[13px] font-medium text-[#5C4538] dark:text-muted-foreground leading-relaxed">{hostel.description}</p>
            )}
          </div>
        </div>

        {/* Right: status, stay, payment, actions */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-bold text-foreground">Booking status</h2>
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${STATUS_STYLE[booking.status]}`}>{booking.status}</span>
            </div>
            <p className="text-[13px] font-medium text-[#8C8279] dark:text-muted-foreground leading-relaxed">{STATUS_NOTE[booking.status]}</p>
          </div>

          <div className="bg-card rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-1 flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-[#A84A1A]" />Stay</h2>
            <Row label="Hostel" value={booking.hostelName} />
            <Row label="Location" value={booking.location || "—"} />
            <Row label="Move-in" value={booking.moveIn} />
            <Row label="Semester" value={booking.semester} />
          </div>

          <div className="bg-card rounded-2xl shadow-sm p-6">
            <h2 className="text-base font-bold text-foreground mb-1 flex items-center"><Receipt className="w-4 h-4 mr-2 text-[#A84A1A]" />Payment</h2>
            <Row label="Amount paid" value={`GHS ${booking.price.toLocaleString("en-GH")}`} />
            <Row label="Reference" value={booking.reference} />
            <Row label="Booked on" value={booking.date} />
          </div>

          <div className="space-y-3">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#A84A1A] hover:bg-[#8F3E15] text-white py-3.5 rounded-full font-bold text-[14px] transition-colors shadow-sm flex items-center justify-center space-x-2"
            >
              <Navigation className="w-4 h-4" />
              <span>Get directions</span>
            </a>
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full bg-card border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 py-3.5 rounded-full font-bold text-[14px] transition-colors"
              >
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </button>
            )}
          </div>

          {booking.hostelId && booking.status !== "CANCELLED" && (
            <HelpDesk hostelId={booking.hostelId} bookingId={booking.id} hostelName={booking.hostelName} />
          )}

          {booking.hostelId && (
            <div className="bg-card rounded-2xl shadow-sm p-5 lg:p-6">
              <HostelReviews hostelId={booking.hostelId} hostelName={booking.hostelName} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
