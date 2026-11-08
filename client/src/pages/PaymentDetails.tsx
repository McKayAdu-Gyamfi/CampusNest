import { ArrowLeft, ChevronRight, Lock, Moon } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import SelectedUnitCard from "@/components/SelectedUnitCard";
import BookingProgress from "@/components/BookingProgress";
import { useTheme } from "@/components/theme-provider";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { missingProfileFields } from "@/lib/profile";
import { clearPendingPayment, getPendingPayment, setPendingPayment } from "@/lib/pendingPayment";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
import { createStudentBooking } from "@/lib/studentBooking";
import { payWithPaystack } from "@/lib/paystack";
import { useToast } from "@/components/ui/toaster";
import { errorMessage } from "@/lib/adminApi";

/** Payment needs a chosen room (or an unfinished paid booking to complete); otherwise there's nothing to pay for. */
export default function PaymentDetails() {
  const { state } = useLocation();
  const { user } = useAuth();
  if (!state?.returnToHostel && !getPendingPayment(user?.id)) return <Navigate to={ROUTES.student.explore} replace />;
  return <PaymentStep />;
}

function PaymentStep() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refresh: refreshBookings } = useBookings();
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [selectedMethod, setSelectedMethod] = useState<'momo' | 'card'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);

  const [momoDetails, setMomoDetails] = useState({
    number: "",
    network: "MTN",
    name: user?.name ?? ""
  });

  // Normally the room chosen on the previous step. If they come back with only
  // an unfinished (already paid) booking, rebuild just enough to finish it.
  const pendingForSummary = getPendingPayment(user?.id);
  const summary = location.state ?? {
    hostelName: pendingForSummary?.hostelName ?? "Your hostel",
    location: "",
    image: "",
    roomLabel: "",
    price: pendingForSummary?.price ?? 0,
    returnPath: null,
    returnToHostel: pendingForSummary?.hostelId ?? null,
  };

  // The booking page only passes hostel/room/price, so fees default to 0.
  const serviceFee: number = summary.serviceFee ?? 0;
  const discount: number = summary.discount ?? 0;
  const totalDue = summary.price + serviceFee - discount;

  const handleBack = () => {
    navigate(-1);
  };

  const pending = getPendingPayment(user?.id);
  const missing = missingProfileFields(user?.details, "STUDENT");

  const goCompleteProfile = () =>
    navigate(ROUTES.student.settings, { state: { returnTo: location.pathname, returnState: location.state } });

  // Creates the booking for a payment that is already confirmed.
  const finishBooking = async (reference: string, channel?: string, over?: { hostelId: string; price: number }) => {
    const hostelId = over?.hostelId ?? summary.returnToHostel;
    const price = over?.price ?? summary.price;
    try {
      await createStudentBooking({ hostelId, price, paymentReference: reference });
    } catch (e) {
      setPendingPayment({ reference, hostelId, price, userId: user?.id ?? "", hostelName: summary.hostelName });
      const msg = errorMessage(e);
      toast(`Payment received (ref ${reference}) but the booking is not finished: ${msg}. Your payment is saved: fix this, then tap "Finish booking".`, "error");
      await refetch(); // pick up profile changes so the retry can pass
      setIsProcessing(false);
      return;
    }
    clearPendingPayment();
    await refreshBookings();
    navigate(ROUTES.student.confirmation, {
      state: {
        ...summary, totalDue, reference, moveIn: 'Jan 12, 2026',
        paymentMethod: channel === 'mobile_money' ? `MoMo · ${momoDetails.network}` : 'Card',
      },
      replace: true,
    });
  };

  const handleProcessPayment = async () => {
    if (isProcessing) return;
    // Never take money from someone whose booking the server will refuse.
    if (missing.length > 0) {
      toast(`Complete your profile before paying: ${missing.map((m) => m.label).join(", ")}.`, "error");
      goCompleteProfile();
      return;
    }
    setIsProcessing(true);
    try {
      // Opens the Paystack checkout; resolves only after the server has verified the charge.
      const payment = await payWithPaystack(totalDue, selectedMethod);
      if (!payment) {
        setIsProcessing(false); // popup closed without paying
        return;
      }
      await finishBooking(payment.reference, payment.channel);
    } catch (e) {
      toast(errorMessage(e), "error");
      setIsProcessing(false);
    }
  };

  const handleFinishPending = async () => {
    if (!pending || isProcessing) return;
    if (missing.length > 0) { goCompleteProfile(); return; }
    setIsProcessing(true);
    await finishBooking(pending.reference, undefined, { hostelId: pending.hostelId, price: pending.price });
  };

  const methodCard = (id: "momo" | "card") =>
    `p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
      selectedMethod === id ? "border-primary bg-primary/5" : "border-border/80 bg-card hover:border-primary/40"
    }`;
  const radio = (id: "momo" | "card") =>
    `w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedMethod === id ? "border-primary bg-primary" : "border-border"}`;
  const fieldCls = "h-11 bg-background border-border/80 text-[15px] font-medium text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground pb-12 transition-colors">
      {/* Header */}
      <header className="px-6 py-6 sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border text-foreground shadow-sm hover:bg-muted transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Complete Booking</h1>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border text-foreground shadow-sm hover:bg-muted transition-colors cursor-pointer"
          >
            <Moon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-background/50 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-md mx-auto">
          <BookingProgress currentStep={2} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8">
        {pending && (
          <div className="mb-8 rounded-2xl border border-amber-300/60 bg-amber-50 text-amber-900 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <p className="text-[14px] font-extrabold">Payment received, booking not finished</p>
              <p className="text-[12px] font-medium mt-0.5">
                {pending.hostelName ?? "Your hostel"} · ref {pending.reference}.{missing.length > 0 ? ` Complete your profile (${missing.map((m) => m.label).join(", ")}) and then finish the booking.` : " You won't be charged again."}
              </p>
            </div>
            <button onClick={handleFinishPending} disabled={isProcessing} className="shrink-0 h-10 px-5 rounded-full bg-primary text-primary-foreground font-extrabold text-sm disabled:opacity-60 cursor-pointer">
              {missing.length > 0 ? "Complete profile" : isProcessing ? "Finishing…" : "Finish booking"}
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-10">

          {/* Left Column */}
          <div className="flex-1 space-y-10">

            {/* Selected Unit Summary */}
            <SelectedUnitCard image={summary.image} hostelName={summary.hostelName} location={summary.location} roomLabel={summary.roomLabel} price={summary.price} />

            {/* Move-in Details */}
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight mb-5">Move-in Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-card border border-border/80 shadow-sm p-5 rounded-2xl">
                  <p className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground mb-3">Move-in date</p>
                  <p className="font-bold text-foreground text-lg tracking-tight">Jan 12, 2026</p>
                </div>
                <div className="bg-card border border-border/80 shadow-sm p-5 rounded-2xl">
                  <p className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground mb-3">Semester</p>
                  <p className="font-bold text-foreground text-lg tracking-tight">Spring 2026</p>
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight mb-5">Payment Method</h2>
              <div className="space-y-4">
                <div onClick={() => setSelectedMethod("momo")} className={methodCard("momo")}>
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary font-extrabold text-sm flex items-center justify-center shrink-0">MoMo</div>
                    <div>
                      <h4 className="font-bold text-foreground text-[15px]">Mobile Money</h4>
                      <p className="text-xs font-medium text-muted-foreground">{momoDetails.network}{momoDetails.number ? ` · ${momoDetails.number}` : ""}</p>
                    </div>
                  </div>
                  <div className={radio("momo")}>{selectedMethod === "momo" && <div className="w-2 h-2 rounded-full bg-white dark:bg-card" />}</div>
                </div>

                <div onClick={() => setSelectedMethod("card")} className={methodCard("card")}>
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-[15px]">Debit / credit card</h4>
                      <p className="text-xs font-medium text-muted-foreground">Visa, Mastercard</p>
                    </div>
                  </div>
                  <div className={radio("card")}>{selectedMethod === "card" && <div className="w-2 h-2 rounded-full bg-white dark:bg-card" />}</div>
                </div>
              </div>

              {selectedMethod === "momo" && (
                <Card className="bg-card border border-border/80 shadow-sm rounded-2xl p-5 md:p-6 mt-4 animate-in slide-in-from-top-4 fade-in duration-300">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-foreground mb-1.5 block">Mobile Money number</label>
                      <Input value={momoDetails.number} placeholder="e.g. 024 123 4567" onChange={(e) => setMomoDetails({ ...momoDetails, number: e.target.value })} className={fieldCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-foreground mb-1.5 block">Network</label>
                        <Input value={momoDetails.network} onChange={(e) => setMomoDetails({ ...momoDetails, network: e.target.value })} className={fieldCls} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-foreground mb-1.5 block">Account name</label>
                        <Input value={momoDetails.name} onChange={(e) => setMomoDetails({ ...momoDetails, name: e.target.value })} className={fieldCls} />
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Right Column - Summary & Action */}
          <div className="w-full md:w-[420px] shrink-0 mt-8 md:mt-0">
            <div className="sticky top-32 space-y-6">
              <Card className="bg-card border border-border/80 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-2xl p-8 transition-colors">
                <h2 className="text-2xl font-bold text-foreground tracking-tight mb-8">Booking Summary</h2>

                <div className="space-y-3.5 mb-6 text-[14px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Room · semester</span>
                    <span className="font-semibold text-foreground">GHS {summary.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Service fee</span>
                    <span className="font-semibold text-foreground">GHS {serviceFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-emerald-600 font-medium">Early-bird discount</span>
                    <span className="font-semibold text-emerald-600">− GHS {discount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex flex-col justify-center bg-muted/40 p-6 rounded-2xl border border-border/50 mb-8">
                  <span className="font-bold text-foreground uppercase tracking-widest text-[11px] block text-left mb-3 opacity-70">Total Amount Due</span>
                  <span className="font-extrabold text-primary text-4xl tracking-tight leading-none">GHS {totalDue.toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-muted-foreground px-2 text-center mb-8">
                  <Lock className="w-4 h-4 text-emerald-500" />
                  <span>Secure payment · free cancellation before move-in</span>
                </div>

                <button
                  onClick={handleProcessPayment}
                  disabled={isProcessing}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-bold py-5 rounded-2xl shadow-[0_8px_25px_rgba(197,106,48,0.3)] flex justify-center items-center transition-transform hover:scale-[1.02] active:scale-[0.98] text-[16px] cursor-pointer"
                >
                  {isProcessing ? "Processing..." : <>Pay GHS {totalDue.toLocaleString()} <ChevronRight className="w-5 h-5 ml-2" /></>}
                </button>
              </Card>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
