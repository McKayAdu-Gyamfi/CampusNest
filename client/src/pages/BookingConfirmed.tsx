import { Check, Bell, Navigation, Receipt, CalendarDays, Wallet, CreditCard, MapPin, CircleCheck, Clock, KeyRound } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { useLocation, useNavigate, Navigate } from "react-router-dom";

export default function BookingConfirmed() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state;

  if (!state) {
    return <Navigate to={ROUTES.student.home} replace />;
  }

  const {
    hostelName,
    roomLabel,
    totalDue,
    paymentMethod,
    reference,
    moveIn,
    image,
    location: hostelLocation,
  } = state;

  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([hostelName, hostelLocation].filter(Boolean).join(", "))}`;

  const details = [
    { icon: Receipt, label: "Reference", value: reference, cls: "text-[#463C38] dark:text-foreground" },
    { icon: CalendarDays, label: "Move-in", value: moveIn, cls: "text-[#463C38] dark:text-foreground" },
    { icon: Wallet, label: "Paid", value: `GHS ${totalDue.toLocaleString()}`, cls: "text-[#137333] dark:text-emerald-400" },
    { icon: CreditCard, label: "Method", value: paymentMethod, cls: "text-[#463C38] dark:text-foreground" },
  ];

  const steps = [
    { icon: CircleCheck, title: "Payment received", text: "Your payment was verified.", state: "done" },
    { icon: Clock, title: "Manager reviews your request", text: "You'll be notified as soon as they respond.", state: "now" },
    { icon: KeyRound, title: "Move in", text: `Your room is ready from ${moveIn}.`, state: "next" },
  ] as const;

  const Actions = (
    <>
      <button
        onClick={() => navigate(ROUTES.student.bookings, { replace: true })}
        className="w-full bg-[#C56A30] hover:bg-[#B85822] active:bg-[#B85822] text-white font-extrabold py-4 rounded-full shadow-md flex justify-center items-center transition-all text-[15px] cursor-pointer"
      >
        View my booking
      </button>
      <a
        href={directionsUrl} target="_blank" rel="noopener noreferrer"
        className="w-full bg-white dark:bg-card hover:bg-[#FDF6EF] dark:hover:bg-muted active:bg-gray-50 text-[#C56A30] border border-[#C56A30] font-extrabold py-4 rounded-full shadow-sm flex justify-center items-center transition-all text-[15px] cursor-pointer"
      >
        <Navigation className="w-4 h-4 mr-2" />
        Get directions
      </a>
    </>
  );

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F8F6F3] dark:bg-background text-[#463C38] dark:text-foreground font-sans">

      {/* Top Gradient Area */}
      <div className="w-full bg-gradient-to-br from-[#3D261B] to-[#B85822] px-6 pt-16 pb-12 md:pt-14 md:pb-24 rounded-b-[40px] shadow-sm relative overflow-hidden flex flex-col items-center">
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#C56A30]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-full bg-white dark:bg-card flex items-center justify-center mb-6 shadow-lg relative z-10">
          <Check className="w-8 h-8 text-[#137333] dark:text-emerald-400" strokeWidth={3} />
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 tracking-tight relative z-10 text-center">Payment received!</h1>
        <p className="text-white/90 font-medium relative z-10 text-center">Your request for Spring 2026 is with the hostel manager.</p>
      </div>

      <div className="flex-1 px-5 md:px-8 -mt-6 md:-mt-14 relative z-20 pb-44 md:pb-16 w-full max-w-5xl mx-auto">
        <div className="md:grid md:grid-cols-[1.45fr_1fr] md:gap-8 md:items-start">

          {/* Booking Card */}
          <div className="bg-white dark:bg-card rounded-3xl p-5 md:p-0 shadow-sm md:shadow-md border border-[#E5E0D8] dark:border-border mb-6 md:mb-0 overflow-hidden">
            {/* Desktop: photo banner */}
            <div className="hidden md:block relative h-56">
              <img src={image} className="w-full h-full object-cover" alt={hostelName} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute top-4 left-4 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center space-x-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span>Awaiting approval</span>
              </span>
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <h3 className="font-extrabold text-2xl leading-tight">{hostelName}</h3>
                <p className="text-sm font-semibold text-white/90 flex items-center mt-1">
                  <MapPin className="w-4 h-4 mr-1" />{roomLabel}{hostelLocation ? ` · ${hostelLocation}` : ""}
                </p>
              </div>
            </div>

            {/* Mobile: compact header */}
            <div className="md:hidden flex items-center space-x-4 mb-5 pb-5 border-b border-[#E5E0D8]/60">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                <img src={image} className="w-full h-full object-cover" alt="Selected Room" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#3D261B] dark:text-foreground text-lg leading-tight mb-1">{hostelName}</h3>
                <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground mb-2">{roomLabel}</p>
                <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center inline-flex space-x-1 w-fit">
                  <span className="w-1 h-1 rounded-full bg-amber-500" />
                  <span>AWAITING APPROVAL</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-5 gap-x-4 md:gap-5 md:p-6">
              {details.map(({ icon: Icon, label, value, cls }) => (
                <div key={label} className="md:flex md:items-start md:gap-3 md:rounded-2xl md:bg-[#F8F6F3] md:p-4 min-w-0">
                  <span className="hidden md:flex w-9 h-9 rounded-xl bg-white dark:bg-card text-[#C56A30] items-center justify-center shrink-0 shadow-sm"><Icon className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#8C8279] dark:text-muted-foreground mb-0.5">{label}</p>
                    <p className={`font-extrabold text-[14px] break-words ${cls}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* What happens next (desktop) */}
            <div className="hidden md:block bg-white dark:bg-card rounded-3xl p-6 shadow-md border border-[#E5E0D8] dark:border-border">
              <h2 className="text-[16px] font-extrabold text-[#3D261B] dark:text-foreground mb-5">What happens next</h2>
              <ol className="space-y-5">
                {steps.map(({ icon: Icon, title, text, state: st }, i) => (
                  <li key={title} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${st === "done" ? "bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400" : st === "now" ? "bg-[#C56A30] text-white" : "bg-[#F1ECE6] text-[#8C8279] dark:text-muted-foreground"}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      {i < steps.length - 1 && <span className="w-px flex-1 bg-[#E5E0D8] mt-1.5" />}
                    </div>
                    <div className="pb-1">
                      <p className={`text-[14px] font-extrabold ${st === "next" ? "text-[#8C8279] dark:text-muted-foreground" : "text-[#3D261B] dark:text-foreground"}`}>{title}</p>
                      <p className="text-[12px] font-medium text-[#8C8279] dark:text-muted-foreground mt-0.5">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-7 flex flex-col gap-3">{Actions}</div>
            </div>

            {/* Info Banner */}
            <div className="bg-[#FDF6EF] dark:bg-card border border-[#F5E5D5] rounded-2xl p-4 flex items-start space-x-3 text-[#B85822]">
              <Bell className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
              <p className="text-sm font-medium leading-snug">
                We'll notify you here as soon as the manager approves or declines your request.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fixed bottom buttons */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-transparent p-5 pb-8 z-50 flex flex-col space-y-3">
        {Actions}
      </div>

    </div>
  );
}
