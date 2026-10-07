import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, CheckCircle, Monitor, BookOpen, Search, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { signUpStudent, signInEmail, registerManager } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

// import { TygerAvatar } from 'tyger-avatar';

const AVATARS = [
  "#A3735D", "#3D261B", "#D3B78F", "#C56A30",
  "#D49561", "#758356", "#577789", "#885973",
  "#D6A327", "#4F5051", "#A16956", "#6C9482"
];

const ROLES = [
  { id: "student", label: "Student", icon: BookOpen },
  { id: "manager", label: "Manager", icon: Shield },
] as const;

export default function Login() {
  const [step, setStep] = useState<"institution" | "login" | "avatar">("institution");
  const [role, setRole] = useState<"student" | "manager">("student");
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitution, setSelectedInstitution] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const [activeSlide, setActiveSlide] = useState(0);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signin');
  const [showMobileForm, setShowMobileForm] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const INSTITUTIONS = [
    { id: 'ashesi', name: 'Ashesi University', location: 'Berekuso', abbr: 'AU' },
    { id: 'ug', name: 'Univ. of Ghana', location: 'Legon', abbr: 'UG' },
    { id: 'knust', name: 'KNUST', location: 'Kumasi', abbr: 'KN' },
    { id: 'gimpa', name: 'GIMPA', location: 'Achimota', abbr: 'GI' }
  ];

  const filteredInstitutions = INSTITUTIONS.filter(inst => 
    inst.name.toLowerCase().includes(institutionQuery.toLowerCase()) || 
    inst.abbr.toLowerCase().includes(institutionQuery.toLowerCase())
  );

  const handleLoginClick = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // guard against double-submit (Review Focus #5)
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (role === "manager") {
        if (authMode === "signup") {
          await registerManager(email, password, fullName || undefined);
        } else {
          await signInEmail(email, password);
        }
        await refetch();
        navigate("/manager");
        return;
      }

      // Student path
      if (authMode === "signup") {
        await signUpStudent(email, password, fullName || undefined);
      } else {
        await signInEmail(email, password);
      }
      await refetch();

      if (authMode === "signup") {
        // New account — continue to the (cosmetic, frontend-only) avatar
        // picker before landing on the home page.
        setStep("avatar");
      } else {
        navigate("/");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Couldn't reach the server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    // The avatar picker is cosmetic only — the account already exists by
    // this point (created during the signup call in handleLoginClick).
    navigate("/");
  };

  if (step === "institution") {
    return (
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative font-sans bg-[#F8F6F3] sm:bg-gradient-to-br sm:from-[#4A2E1B] sm:to-[#2A1A0F]">
        {/* Floating background circles - Desktop Only */}
        <div 
          className="hidden sm:block absolute top-[-10%] right-[-15%] w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ backgroundColor: '#6B4226', animation: 'float 15s ease-in-out infinite' }}
        />
        <div 
          className="hidden sm:block absolute bottom-[-15%] left-[-15%] w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ backgroundColor: '#5C361D', animation: 'float 18s ease-in-out infinite 5s' }}
        />
        <div 
          className="hidden sm:block absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full pointer-events-none"
          style={{ backgroundColor: '#452714', animation: 'float 22s ease-in-out infinite 2s' }}
        />

        {/* Top Header - Desktop Only */}
        <div className="hidden sm:block absolute top-8 left-8 z-10">
          <Logo iconClassName="h-10 w-auto brightness-0 invert" textClassName="text-xl font-bold tracking-tight text-white" />
        </div>

        {/* Center Card */}
        <div className="flex-1 flex items-center justify-center z-10 p-0 sm:p-6 h-full overflow-hidden">
          <div className="bg-transparent sm:bg-[#F8F6F3] sm:rounded-2xl shadow-none sm:shadow-2xl sm:shadow-black/20 w-full h-full sm:h-auto max-w-[540px] p-6 pb-8 pt-8 sm:p-10 flex flex-col">
            
            {/* Progress Bar */}
            <div className="flex items-center w-full mb-6">
              <div className="flex-1 flex items-center space-x-4">
                <div className="flex-1 h-1.5 bg-[#E5E0D8] rounded-full overflow-hidden">
                  <div className="h-full bg-canyon rounded-full w-1/2"></div>
                </div>
                <span className="text-xs font-bold text-[#8C8279] whitespace-nowrap">2 / 4</span>
              </div>
            </div>

            {/* Role Selector */}
            <div className="flex items-center bg-[#EFE9DD] rounded-full p-1 mb-6 w-full">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer ${
                      isActive ? "bg-white text-[#463C38] shadow-sm" : "text-[#8C8279] hover:text-[#463C38]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>

            {role === "student" ? (
              <>
                {/* Header */}
                <div className="mb-6">
                  <h1 className="text-[28px] font-extrabold tracking-tight text-[#463C38] mb-1.5">
                    Where do you study?
                  </h1>
                  <p className="text-[15px] text-[#8C8279] font-medium">
                    We'll show hostels closest to your campus.
                  </p>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A29A91] w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search university..."
                    value={institutionQuery}
                    onChange={(e) => setInstitutionQuery(e.target.value)}
                    className="h-12 w-full pl-12 pr-4 bg-white border-[#E5E0D8] rounded-xl text-[15px] font-medium text-[#463C38] focus-visible:ring-2 focus-visible:ring-canyon/30 focus-visible:border-canyon placeholder:text-[#A29A91] transition-all shadow-sm"
                  />
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 flex-1 sm:flex-none overflow-y-auto sm:overflow-visible pr-2 sm:pr-0 pb-12 sm:pb-0 hide-scrollbar">
                  {filteredInstitutions.map((inst) => {
                    const isSelected = selectedInstitution === inst.id;
                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelectedInstitution(inst.id)}
                        className={`flex items-center text-left p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-canyon bg-canyon/5 shadow-sm'
                            : 'border-border/60 bg-transparent hover:border-border hover:bg-white/50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[14px] flex-shrink-0 mr-3 ${
                          isSelected ? 'bg-canyon/10 text-canyon' : 'bg-muted text-muted-foreground'
                        }`}>
                          {inst.abbr}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[13px] text-[#463C38] truncate">{inst.name}</div>
                          <div className="text-[11px] font-medium text-[#8C8279] truncate">{inst.location}</div>
                        </div>
                        {isSelected && (
                          <div className="ml-2 w-5 h-5 rounded-full bg-canyon flex items-center justify-center flex-shrink-0">
                            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-canyon/10 flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-canyon" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#463C38] mb-1.5">
                  Property manager access
                </h1>
                <p className="text-[15px] text-[#8C8279] font-medium max-w-xs">
                  Sign in to manage your hostels, bookings, and clients.
                </p>
              </div>
            )}

            {/* Bottom Buttons */}
            <div className="mt-auto pt-4 flex items-center space-x-4 w-full">
              <button
                onClick={() => {
                  if (role !== "student" || selectedInstitution) setStep("login");
                }}
                className={`flex-1 h-[52px] sm:h-12 w-full rounded-full font-bold text-[16px] sm:text-[14px] transition-all flex items-center justify-center shadow-md ${
                  role !== "student" || selectedInstitution
                    ? 'bg-canyon text-white hover:shadow-lg transform hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-70'
                }`}
                disabled={role === "student" && !selectedInstitution}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "avatar") {
    return (
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#F8F6F3] text-[#463C38] font-sans">
        
        {/* Header */}
        <header className="px-6 py-6 flex items-center justify-between z-10">
          <button onClick={() => setStep("login")} className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[#E5E0D8] text-[#463C38] shadow-sm hover:bg-[#F8F6F3] transition-colors cursor-pointer shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-end space-x-4 ml-6">
            <div className="flex-1 h-1.5 bg-[#E5E0D8] rounded-full overflow-hidden max-w-[200px]">
              <div className="h-full bg-[#C56A30] rounded-full w-3/4"></div>
            </div>
            <span className="text-xs font-bold text-[#8C8279] whitespace-nowrap">3 / 4</span>
          </div>
        </header>

        <div className="flex-1 px-6 pt-2 pb-32 overflow-y-auto hide-scrollbar max-w-md mx-auto w-full">
          <h1 className="text-3xl font-extrabold text-[#3D261B] mb-2 tracking-tight">Choose your avatar</h1>
          <p className="text-[#8C8279] mb-10 font-medium">Pick a character to represent you.</p>
          
          {/* Active Avatar Preview */}
          <div className="flex justify-center mb-10">
            <div 
              className="w-28 h-28 rounded-full border-4 border-[#C56A30] flex items-center justify-center text-white font-extrabold text-4xl shadow-md transition-colors"
              style={{ backgroundColor: selectedAvatar || "#A3735D" }}
            >
              SA
            </div>
          </div>

          {/* Color Grid */}
          <div className="grid grid-cols-4 gap-4 w-full mb-8">
            {AVATARS.map((color, idx) => (
              <button 
                key={idx}
                onClick={() => setSelectedAvatar(color)}
                className={`aspect-square rounded-full transition-all duration-300 cursor-pointer ${
                  selectedAvatar === color 
                    ? 'ring-4 ring-[#C56A30] ring-offset-2 ring-offset-[#F8F6F3] scale-105' 
                    : 'hover:scale-105 shadow-sm'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>

          <button className="w-full h-14 rounded-xl border-2 border-dashed border-[#C56A30]/40 text-[#C56A30] font-bold text-[15px] flex items-center justify-center hover:bg-[#C56A30]/5 transition-colors cursor-pointer">
            <span className="text-lg mr-2">+</span> Upload your own photo
          </button>
        </div>

        {/* Fixed Bottom Continue Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E0D8] p-5 pb-8 z-50 rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.03)] max-w-md mx-auto w-full">
          <button 
            onClick={handleComplete}
            disabled={!selectedAvatar}
            className={`w-full h-14 rounded-full font-bold text-[16px] flex items-center justify-center transition-all ${
              selectedAvatar 
                ? 'bg-[#C56A30] text-white shadow-md cursor-pointer hover:bg-[#B85822]' 
                : 'bg-[#E5E0D8] text-[#A29A91] cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>

      </div>
    );
  }

  // ── Login Step: Split-screen layout ──
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden select-none bg-soft-linen relative">
      
      {/* ─── Left Panel ─── */}
      <div className={`${showMobileForm ? 'hidden' : 'flex'} w-full lg:w-[45%] h-full relative overflow-hidden flex-col justify-between bg-gradient-to-br from-[#6c5e57] to-ironwood`}
      >
        {/* Diagonal stripe pattern overlay */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,1) 10px, rgba(255,255,255,1) 12px)',
          }}
        />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 pb-10 lg:p-10 overflow-y-auto hide-scrollbar">
          
          {/* Logo */}
          <div>
            <Logo iconClassName="h-14 w-auto brightness-0 invert" textClassName="text-2xl font-bold tracking-tight text-white" />
            {role === "manager" && (
              <span className="block mt-1 ml-[62px] text-[11px] font-bold tracking-[0.2em] uppercase text-canyon">
                For Property Managers
              </span>
            )}
          </div>
          
          {/* Middle area with carousel */}
          <div className="flex-1 flex flex-col justify-end lg:justify-center mt-18 lg:mt-24 pb-6 lg:pb-0">
            {/* Carousel Indicators */}
            <div className="flex items-center space-x-2 mb-4">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === 0 ? 'w-8 bg-canyon' : 'w-2 bg-white/30'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === 1 ? 'w-8 bg-canyon' : 'w-2 bg-white/30'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeSlide === 2 ? 'w-8 bg-canyon' : 'w-2 bg-white/30'}`} />
            </div>

            <div className="grid w-full items-center">
              {/* Slide 1 */}
              <div className={`col-start-1 row-start-1 transition-all duration-700 ease-in-out ${activeSlide === 0 ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-8 pointer-events-none -z-10'}`}>
                <div className="mb-6">
                  <span className="inline-block px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 border border-white/25 rounded-full backdrop-blur-sm">
                    {role === "manager" ? "HOSTEL MANAGER DASHBOARD" : "CAMPUS / HOSTEL AT DUSK"}
                  </span>
                </div>
                <h2 className="text-white text-4xl lg:text-[42px] font-bold leading-[1.15] tracking-tight mb-5">
                  {role === "manager" ? <>List your hostel,<br/>reach more students</> : <>Find your perfect<br/>room near campus</>}
                </h2>
                <p className="text-white/90 text-[16px] font-medium leading-relaxed max-w-[90%]">
                  {role === "manager"
                    ? "Fill vacancies faster with verified student demand from campuses near you."
                    : "Browse verified hostels around Ashesi, tour rooms in 360°, and book your semester in minutes."}
                </p>
              </div>

              {/* Slide 2 */}
              <div className={`col-start-1 row-start-1 transition-all duration-700 ease-in-out ${activeSlide === 1 ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-8 pointer-events-none -z-10'}`}>
                <div className="mb-6">
                  <span className="inline-block px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 border border-white/25 rounded-full backdrop-blur-sm">
                    {role === "manager" ? "Built for hostel operators" : "Hostel Courtyard"}
                  </span>
                </div>
                <h2 className="text-white text-3xl lg:text-4xl font-bold leading-[1.15] tracking-tight mb-8">
                  {role === "manager" ? <>Running your hostel<br/>just got easier.</> : <>Your next home is<br/>a few clicks away.</>}
                </h2>
                <div className="space-y-4">
                  {role === "manager" ? (
                    <>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Manage bookings and payments in one place</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <Monitor className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Reach verified students near your property</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Get paid out reliably every semester</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Verified hostels near your campus</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <Monitor className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Tour rooms in 360° before you book</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4.5 h-4.5 text-white/90" />
                        </div>
                        <span className="text-white/90 text-[15px] font-medium">Book your semester in minutes</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Slide 3 (Testimonial) */}
              <div className={`col-start-1 row-start-1 transition-all duration-700 ease-in-out ${activeSlide === 2 ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-8 pointer-events-none -z-10'}`}>
                <h2 className="text-white text-[28px] lg:text-[34px] font-bold leading-[1.25] tracking-tight mb-8">
                  {role === "manager"
                    ? "“KayaCampus helped us fill every room before the semester even started.”"
                    : "“Found my room near Ashesi in a weekend — toured it in 360° before I ever visited.”"}
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-[#E5D0BA] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#6c5e57] font-bold text-[15px]">{role === "manager" ? "EO" : "KA"}</span>
                  </div>
                  <div>
                    <div className="text-white font-bold text-[16px]">{role === "manager" ? "Efua O." : "Kwame A."}</div>
                    <div className="text-white/70 text-[13px] font-medium">{role === "manager" ? "Hostel Manager, Berekuso" : "Level 200 · Ashesi"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile buttons */}
            <div className="lg:hidden mt-auto pt-8 pb-2 w-full">
              <button 
                onClick={() => { setAuthMode('signup'); setShowMobileForm(true); }}
                className="w-full h-[52px] rounded-full font-bold text-[16px] bg-canyon text-white shadow-md cursor-pointer hover:shadow-lg transition-all"
              >
                Get started
              </button>
              <p className="text-center text-[13px] text-white/90 mt-4 font-medium">
                Already have an account?{" "}
                <button onClick={() => { setAuthMode('signin'); setShowMobileForm(true); }} className="text-[#C56A30] font-bold cursor-pointer hover:underline">Sign in</button>
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ─── Right Panel (Form) ─── */}
      <div className={`${showMobileForm ? 'flex' : 'hidden'} lg:flex flex-1 items-center justify-center bg-soft-linen p-6 pb-10 lg:p-8 h-full relative overflow-y-auto`}>
        {/* Mobile Back Button */}
        <button 
          onClick={() => setShowMobileForm(false)}
          className="lg:hidden absolute top-6 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-border text-foreground z-10 cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-500 mt-10 lg:mt-0">
          
          {/* Heading */}
          <div className="mb-5">
            {role === "manager" && (
              <div className="inline-flex items-center gap-1.5 mb-3 px-3 py-1 rounded-full bg-canyon/10 text-canyon text-[11px] font-bold uppercase tracking-wide">
                <Shield className="w-3 h-3" />
                <span>Manager sign in</span>
              </div>
            )}
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-[#463C38] leading-tight mb-1.5">
              {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#8C8279] font-medium">
              {role === "manager"
                ? (authMode === 'signup' ? 'Partner with KayaCampus and start listing your hostel.' : 'Sign in to manage your properties.')
                : (authMode === 'signup' ? 'Join Kaya Campus and find your next home.' : 'Sign in to continue your search.')}
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col space-y-4" onSubmit={handleLoginClick}>
            
            {/* Full name */}
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-[#463C38]">Full name</label>
                <Input
                  type="text"
                  placeholder="Sarah Adjei"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
              </div>
            )}
            
            {/* Email */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[#463C38]">{role === "manager" ? "Business email" : "University email"}</label>
              <Input
                type="email"
                required
                placeholder={role === "manager" ? "you@yourhostel.com" : "sarah.adjei@ashesi.edu.gh"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
              />
            </div>
            
            {/* Password */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-[#463C38]">Password</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg bg-white border-[#E5E0D8] text-[#463C38] text-[14px] font-medium placeholder:text-[#A29A91] pr-16 focus-visible:ring-2 focus-visible:ring-burnt-umber/30 focus-visible:border-burnt-umber"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8279] hover:text-[#463C38] text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPassword ? "Hide" : "Show"}</span>
                </button>
              </div>
              {authMode === 'signin' && (
                <div className="flex justify-end pt-1.5 pb-0.5">
                  <button type="button" className="text-[12px] font-semibold text-canyon hover:underline cursor-pointer">
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
            
            {formError && (
              <p className="text-[13px] font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            {/* Create account button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full h-11 ${authMode === 'signup' ? 'mt-1' : 'mt-2'} rounded-full font-bold text-[14px] shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 text-white bg-canyon disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
            >
              <span>{isSubmitting ? "Please wait…" : authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center justify-center space-x-4 my-4">
            <div className="h-px bg-[#E5E0D8] flex-1" />
            <span className="text-xs text-[#8C8279] font-medium">or</span>
            <div className="h-px bg-[#E5E0D8] flex-1" />
          </div>

          {/* SSO: Google for managers, Microsoft for students */}
          {role === "manager" ? (
            <button
              onClick={handleLoginClick}
              className="w-full bg-white border border-[#E5E0D8] shadow-sm hover:shadow-md hover:bg-[#F8F6F3] text-[#463C38] rounded-full h-11 flex items-center justify-center space-x-3 font-semibold text-[14px] transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91C16.66 14.2 17.64 11.9 17.64 9.2z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.98v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.98a9 9 0 0 0 0 8.08l2.97-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.96l2.97 2.33C4.66 5.16 6.65 3.58 9 3.58z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          ) : (
            <button
              onClick={handleLoginClick}
              className="w-full bg-white border border-[#E5E0D8] shadow-sm hover:shadow-md hover:bg-[#F8F6F3] text-[#463C38] rounded-full h-11 flex items-center justify-center space-x-3 font-semibold text-[14px] transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4 mr-1">
                <div className="bg-[#F25022]" />
                <div className="bg-[#7FBA00]" />
                <div className="bg-[#00A4EF]" />
                <div className="bg-[#FFB900]" />
              </div>
              <span>Continue with Microsoft</span>
            </button>
          )}

          {/* Footer Toggle */}
          <p className="text-center text-[12px] text-[#8C8279] mt-4 font-medium">
            {authMode === 'signup' ? (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setAuthMode('signin')} className="font-semibold text-canyon hover:underline cursor-pointer">
                  Sign in
                </button>
              </>
            ) : (
              <>
                New here?{" "}
                <button type="button" onClick={() => setAuthMode('signup')} className="font-semibold text-canyon hover:underline cursor-pointer">
                  Create an account
                </button>
              </>
            )}
          </p>

          {/* Terms footer (only on signup) */}
          {authMode === 'signup' && (
            <p className="text-center text-[11px] text-[#8C8279] mt-3">
              By continuing you agree to our{" "}
              <a href="#" className="font-semibold text-canyon hover:underline">Terms & Privacy Policy</a>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
