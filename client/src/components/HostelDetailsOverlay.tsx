import { ChevronLeft, ChevronRight, Heart, MapPin, Navigation, Star, ThumbsUp, X, Box, Wifi, WashingMachine, ChefHat, Dumbbell, AirVent, ShieldCheck, Droplets, } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useBookings } from "@/contexts/BookingContext";
import HostelReviews from "@/components/HostelReviews";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { formatRating } from "@/lib/hostels";

export interface HostelDetailsOverlayProps {
  selectedHostel: any;
  setSelectedHostel: (hostel: any) => void;
  savedHostels?: string[];
  onSave?: (e: React.MouseEvent, id: string) => void;
}

const AMENITY_ICONS: Record<string, any> = {
  "WiFi": Wifi,
  "Laundry": WashingMachine,
  "Kitchen Shared": ChefHat,
  "Kitchen Personal": ChefHat,
  "Gym": Dumbbell,
  "AC": AirVent,
  "Security": ShieldCheck,
  "Water": Droplets,
};

export default function HostelDetailsOverlay({ selectedHostel, setSelectedHostel, savedHostels = [], onSave }: HostelDetailsOverlayProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<number | null>(1);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [renderedHostel, setRenderedHostel] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { bookings } = useBookings();

  useEffect(() => {
    if (selectedHostel) {
      setRenderedHostel(selectedHostel);
      setSelectedRoom(1);
      setActiveImageIndex(null);
      const t = setTimeout(() => setIsOpen(true), 20);
      return () => clearTimeout(t);
    } else {
      setIsOpen(false);
      const t = setTimeout(() => setRenderedHostel(null), 500);
      return () => clearTimeout(t);
    }
  }, [selectedHostel]);

  const activeBooking = bookings.find((b) => b.status === "PENDING" || b.status === "CONFIRMED");
  const hasActiveBooking = !!activeBooking;

  const roomTypes = [
    { label: "Premium Studio", subtitle: "1 person · ensuite", value: 1, priceOffset: 2000, amenities: ["Air-Conditioned", "Ensuite"] },
    { label: "Standard Single", subtitle: "1 person · shared bath", value: 2, priceOffset: 0, amenities: [] },
  ];

  const galleryList: string[] = renderedHostel?.gallery || [];
  const activeImage = activeImageIndex !== null ? galleryList[activeImageIndex] : null;

  const showPrevImage = () => setActiveImageIndex((i) => (i === null ? i : (i - 1 + galleryList.length) % galleryList.length));
  const showNextImage = () => setActiveImageIndex((i) => (i === null ? i : (i + 1) % galleryList.length));

  useEffect(() => {
    if (activeImageIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveImageIndex(null);
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "ArrowRight") showNextImage();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImageIndex, galleryList.length]);

  if (!renderedHostel) return null;

  const hostel = renderedHostel;
  // Booked here: show success (green) instead of the blocked (red) state.
  const bookedHere = !!activeBooking && activeBooking.hostelId === hostel.id;
  const bookedHereLabel = activeBooking?.status === "CONFIRMED" ? "Room booked ✓ You're all set" : "Room booked ✓ Awaiting manager approval";
  const isAvailable = hostel.availability?.toUpperCase() === "AVAILABLE";
  const roomsBadge = (className = "") =>
    hostel.roomsTotal ? (
      <div
        role="img"
        aria-label={`${hostel.roomsAvailable} of ${hostel.roomsTotal} rooms available, ${hostel.bedsFree} of ${hostel.bedsTotal} beds free`}
        title={`${hostel.roomsAvailable} of ${hostel.roomsTotal} rooms available · ${hostel.bedsFree} of ${hostel.bedsTotal} beds free`}
        className={`w-[76px] h-[76px] rounded-full bg-white/95 backdrop-blur-sm shadow-lg border-2 flex flex-col items-center justify-center leading-none ${hostel.roomsAvailable > 0 ? "border-[#137333]/40" : "border-[#C5221F]/40"} ${className}`}
      >
        <span className={`text-[22px] font-extrabold tracking-tight ${hostel.roomsAvailable > 0 ? "text-[#137333] dark:text-emerald-400" : "text-[#C5221F] dark:text-red-400"}`}>{hostel.roomsAvailable}<span className="text-[13px] text-muted-foreground font-bold">/{hostel.roomsTotal}</span></span>
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground mt-1">rooms left</span>
      </div>
    ) : null;
  const extraGalleryCount = Math.max((hostel.gallery?.length || 0) - 3, 0);

  const handleBook = () => {
    if (!selectedRoom || hasActiveBooking) return;
    const activeRoomObj = roomTypes.find((t) => t.value === selectedRoom) || roomTypes[1];
    const finalPrice = Number(hostel.startingPrice) + activeRoomObj.priceOffset;
    navigate(ROUTES.student.checkout, {
      state: {
        hostelName: hostel.name,
        location: hostel.location,
        image: hostel.image,
        roomLabel: activeRoomObj.label,
        price: finalPrice,
        returnToHostel: hostel.id,
        returnPath: window.location.pathname,
      },
    });
  };

  const handlePreview360 = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const activeRoomObj = roomTypes.find((t) => t.value === selectedRoom) || roomTypes[1];
    const finalPrice = Number(hostel.startingPrice) + activeRoomObj.priceOffset;
    navigate(ROUTES.student.tour, {
      state: {
        returnToHostel: hostel.id,
        returnPath: window.location.pathname,
        hostelName: hostel.name,
        location: hostel.location,
        image: hostel.image,
        roomLabel: activeRoomObj.label,
        price: finalPrice,
        amenities: activeRoomObj.amenities,
      },
    });
  };

  const DescriptionText = <p className="text-sm text-muted-foreground leading-relaxed">{hostel.desc}</p>;

  const AmenitiesGrid = (
    <div className="grid grid-cols-2 gap-y-4">
      {(hostel.amenities || []).map((amenity: string) => {
        const Icon = AMENITY_ICONS[amenity] || Box;
        return (
          <div key={amenity} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10 group-hover:bg-primary/10 transition-colors">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{amenity}</span>
          </div>
        );
      })}
      <div className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Security</span>
      </div>
      <div className="flex items-center space-x-3 group">
        <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
          <Droplets className="w-5 h-5 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground">Water Supply</span>
      </div>
    </div>
  );

  const DescriptionBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-3">Description</h3>
      {DescriptionText}
    </div>
  );

  const AmenitiesBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4">What this place offers</h3>
      {AmenitiesGrid}
    </div>
  );

  const mapQuery = encodeURIComponent(`${hostel.name} ${hostel.location}`);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`;
  const mapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  const LocationMap = (
    <>
      <div className="rounded-2xl overflow-hidden border border-border h-56 bg-muted/50">
        <iframe
          title={`Map showing ${hostel.name}`}
          src={mapEmbedSrc}
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={directionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-primary font-bold text-sm hover:text-primary/80 transition-colors"
      >
        <Navigation className="w-4 h-4" />
        <span>Get Directions</span>
      </a>
    </>
  );

  const LocationBlock = (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-foreground mb-4">Location</h3>
      {LocationMap}
    </div>
  );

  const renderRoomOption = (type: (typeof roomTypes)[number], dense = false, showExpand = true) => (
    <div
      key={type.value}
      className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all hover:bg-accent/50 ${
        selectedRoom === type.value ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 bg-card hover:border-primary/30"
      }`}
      onClick={() => setSelectedRoom(type.value)}
    >
      <div className="flex items-center justify-between w-full gap-3">
        <div>
          <span className={`block font-bold text-foreground ${dense ? "text-sm" : "text-[15px]"}`}>{type.label}</span>
          <span className={`block text-muted-foreground ${dense ? "text-xs" : "text-[13px]"} mt-0.5`}>{type.subtitle}</span>
        </div>
        <span className={`font-bold text-primary shrink-0 ${dense ? "text-sm" : ""}`}>
          GHS {(Number(hostel.startingPrice) + type.priceOffset).toLocaleString()}
        </span>
      </div>

      {showExpand && selectedRoom === type.value && (
        <div className="mt-4 pt-4 border-t border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            {type.amenities.map((amenity, idx) => (
              <span
                key={`${amenity}-${idx}`}
                className="px-3 py-1 rounded-full border border-border text-[10px] font-bold text-foreground bg-accent/30 whitespace-nowrap"
              >
                {amenity}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePreview360}
            className="shrink-0 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 border border-primary/20"
          >
            <Box className="w-3.5 h-3.5" />
            <span>Preview 360°</span>
          </button>
        </div>
      )}
    </div>
  );

  const BookButton = ({ className = "" }: { className?: string }) => (
    <button
      disabled={!selectedRoom || hasActiveBooking}
      onClick={handleBook}
      className={`w-full py-4 rounded-2xl font-bold flex justify-center items-center transition-all text-lg ${
        bookedHere
          ? "bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400 cursor-default border border-[#137333]/30"
          : hasActiveBooking
          ? "bg-red-500/10 text-red-500 opacity-90 cursor-not-allowed border border-red-500/20"
          : selectedRoom
          ? "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(197,106,48,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
      } ${className}`}
    >
      {bookedHere ? bookedHereLabel : hasActiveBooking ? "You already have an active booking" : selectedRoom ? "Book Now" : "Select a room to proceed"}
    </button>
  );

  return (
    <>
      {/* ===== Mobile / Tablet: sliding bottom sheet ===== */}
      <div className="lg:hidden">
        {/* Dimmed Background */}
        <div
          className={`fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setSelectedHostel(null)}
        />

        {/* Sliding Sheet */}
        <div
          className={`fixed bottom-0 left-0 w-full h-[92vh] z-[110] bg-background rounded-t-[40px] flex flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "translate-y-0" : "translate-y-full"}`}
        >
          {/* Header / Hero Image */}
          <div className="relative h-64 shrink-0 bg-muted/50">
            <img src={hostel.image} loading="lazy" className="w-full h-full object-cover transition-opacity duration-300" alt="Property Header" />

            <button
              onClick={() => setSelectedHostel(null)}
              className="absolute top-6 left-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md text-[#3D261B] border border-white/40 hover:bg-white transition-colors shadow-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {onSave && (
              <button
                onClick={(e) => onSave(e, hostel.id)}
                className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md border border-white/40 hover:bg-white transition-colors shadow-sm"
              >
                <Heart className={`w-5 h-5 ${savedHostels.includes(hostel.id) ? "fill-primary text-primary" : "text-[#3D261B]"}`} />
              </button>
            )}

            {roomsBadge("absolute bottom-6 right-5 z-30")}

            {/* Availability pill straddling image/card boundary */}
            <div
              className={`absolute -bottom-3 left-6 font-extrabold text-[11px] px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-sm z-30 ${
                isAvailable ? "bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400" : "bg-[#FCE8E6] dark:bg-red-500/15 text-[#C5221F] dark:text-red-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-[#137333]" : "bg-[#C5221F]"}`} />
              <span>{hostel.availability}</span>
            </div>
          </div>

          {/* Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-28 z-20 relative pt-2">
            <div className="bg-background w-full rounded-t-[32px] pt-6 -mt-6 relative">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-2xl font-bold text-foreground">{hostel.name}</h2>
                <div className="flex items-center space-x-1 bg-primary/10 px-2.5 py-1 rounded-lg shrink-0">
                  <ThumbsUp className="w-4 h-4 text-primary fill-primary" />
                  <span className="text-sm font-bold text-primary">{formatRating(hostel.rating)}</span>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hostel.name} ${hostel.location}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground text-sm font-medium hover:text-primary transition-colors cursor-pointer group w-fit mb-6"
              >
                <MapPin className="w-4 h-4 mr-1 opacity-70 group-hover:opacity-100" />
                <span className="underline decoration-dotted underline-offset-2">{hostel.location}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                <span className="font-bold text-primary">{hostel.distance}</span>
              </a>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Choose a room</h3>

                <div className="space-y-3">{roomTypes.map((type) => renderRoomOption(type))}</div>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Description</h3>
                {DescriptionText}
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-4">What this place offers</h3>
                {AmenitiesGrid}
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase mb-3">Location</h3>
                {LocationMap}
              </div>

              <div className="mb-8"><HostelReviews hostelId={hostel.id} hostelName={hostel.name} /></div>
            </div>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="p-4 bg-background border-t border-border shrink-0 z-30 pb-8 flex items-center justify-between gap-4">
            {(() => {
              const activeRoomObj = roomTypes.find((t) => t.value === selectedRoom) || roomTypes[0];
              const finalPrice = Number(hostel.startingPrice) + activeRoomObj.priceOffset;
              return (
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground truncate">{activeRoomObj.label}</p>
                  <p className="text-xl font-extrabold text-foreground">GHS {finalPrice.toLocaleString()}</p>
                </div>
              );
            })()}
            <button
              disabled={!selectedRoom || hasActiveBooking}
              onClick={handleBook}
              className={`shrink-0 px-8 py-3.5 rounded-full font-bold transition-all ${
                bookedHere
                  ? "bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400 cursor-default border border-[#137333]/30"
                  : hasActiveBooking
                  ? "bg-red-500/10 text-red-500 opacity-90 cursor-not-allowed border border-red-500/20"
                  : selectedRoom
                  ? "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(197,106,48,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
              }`}
            >
              {bookedHere ? "Booked ✓" : hasActiveBooking ? "Unavailable" : "Book room"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== Desktop: full-page split layout ===== */}
      <div
        className={`hidden lg:block fixed inset-y-0 right-0 left-[88px] z-[110] bg-background overflow-y-auto transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="max-w-6xl mx-auto px-10 py-8">
          {/* Top bar: notifications + avatar */}
          <div className="flex items-center justify-end gap-4 mb-6">
            <NotificationsDropdown />
            <Link to={ROUTES.student.profile} className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90 shrink-0">
              {getInitials(user?.name || user?.email)}
            </Link>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm font-bold mb-6">
            <button
              onClick={() => setSelectedHostel(null)}
              className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Explore</span>
            </button>
            <span className="text-muted-foreground/50">/</span>
            <span className="text-muted-foreground">{hostel.name}</span>
          </div>

          <div className="grid grid-cols-3 gap-10 items-start">
            {/* Left column */}
            <div className="col-span-2">
              {/* Hero image */}
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-muted/50 mb-4">
                <img src={hostel.image} loading="lazy" className="w-full h-full object-cover" alt="Property Header" />

                <div
                  className={`absolute top-5 left-5 font-extrabold text-[11px] px-3 py-1.5 rounded-full flex items-center space-x-1.5 ${
                    isAvailable ? "bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400" : "bg-[#FCE8E6] dark:bg-red-500/15 text-[#C5221F] dark:text-red-400"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-[#137333]" : "bg-[#C5221F]"}`} />
                  <span>{hostel.availability}</span>
                </div>

                {roomsBadge("absolute bottom-5 right-5")}

                {onSave && (
                  <button
                    onClick={(e) => onSave(e, hostel.id)}
                    className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-md border border-white/40 hover:bg-white transition-colors shadow-sm"
                  >
                    <Heart className={`w-5 h-5 ${savedHostels.includes(hostel.id) ? "fill-primary text-primary" : "text-[#3D261B]"}`} />
                  </button>
                )}
              </div>

              {/* Thumbnails */}
              {hostel.gallery && hostel.gallery.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-8">
                  {hostel.gallery.slice(0, 3).map((img: string, idx: number) => (
                    <img
                      key={idx}
                      src={img}
                      loading="lazy"
                      onClick={() => setActiveImageIndex(idx)}
                      className="w-full aspect-square rounded-2xl object-cover border border-border shadow-sm cursor-pointer transition-all hover:opacity-80"
                      alt="Gallery item"
                    />
                  ))}
                  {extraGalleryCount > 0 && (
                    <button
                      onClick={() => setActiveImageIndex(3)}
                      className="w-full aspect-square rounded-2xl bg-foreground text-background font-extrabold text-lg flex items-center justify-center hover:opacity-90 transition-opacity"
                    >
                      +{extraGalleryCount}
                    </button>
                  )}
                </div>
              )}

              {/* Title */}
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-extrabold text-foreground tracking-tight">{hostel.name}</h2>
                <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 py-1 rounded-lg">
                  <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                  <span className="text-sm font-bold text-yellow-700">{formatRating(hostel.rating)}</span>
                </div>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hostel.name} ${hostel.location}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-muted-foreground text-sm font-medium hover:text-primary transition-colors cursor-pointer group w-fit mb-8"
              >
                <MapPin className="w-4 h-4 mr-1 opacity-70 group-hover:opacity-100" />
                <span className="underline decoration-dotted underline-offset-2">{hostel.location}</span>
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                <span>{hostel.distance} from campus</span>
              </a>

              {DescriptionBlock}
              {AmenitiesBlock}
              {LocationBlock}
              <div className="mb-8"><HostelReviews hostelId={hostel.id} hostelName={hostel.name} /></div>
            </div>

            {/* Right column: sticky pricing card */}
            <div className="col-span-1">
              <div className="sticky top-8 bg-card border border-border rounded-2xl p-6 shadow-sm">
                <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground">STARTS FROM</span>
                <div className="flex items-baseline gap-1.5 mt-1 mb-5">
                  <span className="text-3xl font-extrabold text-foreground">GHS {Number(hostel.startingPrice).toLocaleString()}</span>
                  <span className="text-sm font-medium text-muted-foreground">/semester</span>
                </div>
                <span className="text-[11px] font-extrabold tracking-wider text-muted-foreground mb-3 block">CHOOSE A ROOM</span>
                <div className="space-y-3 mb-5">{roomTypes.map((type) => renderRoomOption(type, true))}</div>

                <BookButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full screen Image Preview Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col justify-center items-center backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveImageIndex(null)}
        >
          <button
            className="absolute top-6 right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setActiveImageIndex(null)}
          >
            <X className="w-6 h-6" />
          </button>

          {galleryList.length > 1 && (
            <>
              <button
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrevImage();
                }}
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  showNextImage();
                }}
              >
                <ChevronRight className="w-7 h-7" />
              </button>

              <span className="absolute bottom-6 text-white/80 text-sm font-medium">
                {activeImageIndex! + 1} / {galleryList.length}
              </span>
            </>
          )}

          <img src={activeImage} alt="Preview" className="max-w-[95vw] max-h-[90vh] object-contain shadow-2xl rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
