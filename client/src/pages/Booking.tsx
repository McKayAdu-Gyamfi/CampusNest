import { ArrowLeft, Calendar as CalendarIcon, Lock, ChevronRight, Info, Moon } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import SelectedUnitCard from "@/components/SelectedUnitCard";
import BookingProgress from "@/components/BookingProgress";
import { useTheme } from "@/components/theme-provider";

/** Checkout needs a chosen room: opened directly (or after a refresh) there is nothing to book, so go pick one. */
export default function Booking() {
  const { state } = useLocation();
  if (!state?.hostelName || !state?.returnToHostel) return <Navigate to={ROUTES.student.explore} replace />;
  return <BookingStep />;
}

function BookingStep() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const summary = location.state;

  const handleBack = () => {
    if (summary.returnPath) {
      navigate(summary.returnPath, { replace: true });
    } else {
      navigate(-1);
    }
  };

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
          
          {/* Theme Toggle */}
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border text-foreground shadow-sm hover:bg-muted transition-colors cursor-pointer"
          >
            <Moon className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* Fixed Progress Bar Container */}
      <div className="bg-background/50 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-md mx-auto">
          <BookingProgress currentStep={1} />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8">
        <div className="flex flex-col md:flex-row gap-10">
          
          {/* Left Column - Details */}
          <div className="flex-1 space-y-10">

            {/* Selected Unit Summary */}
            <SelectedUnitCard image={summary.image} hostelName={summary.hostelName} location={summary.location} roomLabel={summary.roomLabel} price={summary.price} />

            {/* Semester Duration info */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Semester Duration</h2>
              </div>

              <Card className="bg-primary/5 border border-primary/20 shadow-sm rounded-2xl p-6 relative overflow-hidden transition-colors">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                
                <div className="flex items-start space-x-5">
                  <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-primary/20 text-primary">
                    <CalendarIcon className="w-7 h-7" />
                  </div>
                  <div className="pt-1">
                    <h3 className="font-bold text-foreground text-xl mb-2 tracking-tight">Semester 1, 2024</h3>
                    <p className="text-sm font-medium text-muted-foreground flex items-center mt-1">
                      <Info className="w-4 h-4 mr-1.5 shrink-0 text-primary/70" />
                      Your booking fully covers the entire 16-week semester automatically.
                    </p>
                  </div>
                </div>

                {/* Selected Dates Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-8">
                   <div className="bg-background w-full border border-border/80 shadow-sm p-5 rounded-2xl transition-colors">
                      <div className="flex items-center text-muted-foreground text-[11px] uppercase font-bold tracking-widest mb-3">
                        Official Check-in
                      </div>
                      <p className="font-bold text-foreground text-lg tracking-tight mb-1">4 Sep 2024</p>
                      <p className="text-sm font-semibold text-muted-foreground flex items-center opacity-80">From 10:00 AM</p>
                   </div>
                   <div className="bg-background w-full border border-border/80 shadow-sm p-5 rounded-2xl transition-colors">
                      <div className="flex items-center text-muted-foreground text-[11px] uppercase font-bold tracking-widest mb-3">
                        Official Check-out
                      </div>
                      <p className="font-bold text-foreground text-lg tracking-tight mb-1">20 Dec 2024</p>
                      <p className="text-sm font-semibold text-muted-foreground flex items-center opacity-80">By 12:00 PM</p>
                   </div>
                </div>
              </Card>
            </div>

          </div>

          {/* Right Column - Summary & Action */}
          <div className="w-full md:w-[420px] shrink-0 mt-8 md:mt-0">
            <div className="sticky top-32 space-y-6">
              <Card className="bg-card border border-border/80 shadow-[0_8px_30px_rgba(0,0,0,0.06)] rounded-2xl p-8 transition-colors">
                <h2 className="text-2xl font-bold text-foreground tracking-tight mb-8">Booking Summary</h2>
                
                <div className="flex flex-col justify-center bg-muted/40 p-6 rounded-2xl border border-border/50 mb-8">
                   <span className="font-bold text-foreground uppercase tracking-widest text-[11px] block text-left mb-3 opacity-70">Total Amount Due</span>
                   <span className="font-extrabold text-primary text-4xl tracking-tight leading-none">GHS {summary.price.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-muted-foreground px-2 text-center mb-8">
                   <Lock className="w-4 h-4 text-emerald-500" />
                   <span>Secure SSL encrypted payment processing</span>
                </div>

                <button 
                  onClick={() => navigate(ROUTES.student.payment, { state: summary })}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-5 rounded-2xl shadow-[0_8px_25px_rgba(59,130,246,0.3)] flex justify-center items-center transition-transform hover:scale-[1.02] active:scale-[0.98] text-[16px]"
                >
                   Proceed to Details <ChevronRight className="w-5 h-5 ml-2" />
                </button>
              </Card>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
