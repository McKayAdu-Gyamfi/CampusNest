import { ChevronLeft, Bell, Compass, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useComingSoon } from "@/contexts/ComingSoonContext";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showComingSoon } = useComingSoon();
  const [notifications] = useState(true);
  const [alerts] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans relative">
      
      {/* Header */}
      <div className="flex items-center px-4 lg:px-8 h-20 pt-6 lg:pt-8 mb-4">
        <button onClick={() => navigate(-1)} className="flex items-center space-x-2 text-foreground hover:opacity-80 transition-opacity cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
          <h1 className="text-xl lg:text-[24px] font-extrabold tracking-tight">Account settings</h1>
        </button>
      </div>

      <div className="px-5 lg:px-8 py-6 space-y-10 w-full">
        
        {/* Personal Information */}
        <div>
          <h2 className="text-[12px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">Full name</label>
              <input 
                type="text" 
                key={user?.name}
                defaultValue={user?.name}
                className="w-full h-[52px] bg-white border border-border/60 rounded-xl px-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">Phone</label>
              <input 
                type="text" 
                placeholder="e.g. 024 123 4567"
                className="w-full h-[52px] bg-white border border-border/60 rounded-xl px-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">Email</label>
              <input 
                type="email" 
                key={user?.email}
                defaultValue={user?.email}
                className="w-full h-[52px] bg-white border border-border/60 rounded-xl px-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-bold text-foreground">University</label>
              <input 
                type="text" 
                defaultValue="Ashesi University"
                className="w-full h-[52px] bg-white border border-border/60 rounded-xl px-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div>
          <h2 className="text-[12px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4">Preferences</h2>
          <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
            
            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <div className="flex items-center space-x-4">
                <Bell className="w-[22px] h-[22px] text-[#C56A30]" />
                <div>
                  <h3 className="font-bold text-[15px] text-foreground">Booking notifications</h3>
                  <p className="text-[12px] text-muted-foreground font-medium">Approvals, payment reminders</p>
                </div>
              </div>
              {/* Toggle Switch */}
              <button 
                onClick={() => showComingSoon("Notification settings")}
                className={`w-12 h-[26px] rounded-full relative transition-colors cursor-pointer ${notifications ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
              >
                <div className={`absolute top-1 w-[18px] h-[18px] bg-white rounded-full transition-transform ${notifications ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-5 border-b border-border/40">
              <div className="flex items-center space-x-4">
                <Compass className="w-[22px] h-[22px] text-[#C56A30]" />
                <div>
                  <h3 className="font-bold text-[15px] text-foreground">New hostel alerts</h3>
                  <p className="text-[12px] text-muted-foreground font-medium">When rooms open near campus</p>
                </div>
              </div>
              <button 
                onClick={() => showComingSoon("Hostel alerts")}
                className={`w-12 h-[26px] rounded-full relative transition-colors cursor-pointer ${alerts ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
              >
                <div className={`absolute top-1 w-[18px] h-[18px] bg-white rounded-full transition-transform ${alerts ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-5">
              <div className="flex items-center space-x-4">
                <Moon className="w-[22px] h-[22px] text-[#C56A30]" />
                <div>
                  <h3 className="font-bold text-[15px] text-foreground">Dark mode</h3>
                  <p className="text-[12px] text-muted-foreground font-medium">Easier on the eyes at night</p>
                </div>
              </div>
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`w-12 h-[26px] rounded-full relative transition-colors cursor-pointer ${darkMode ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
              >
                <div className={`absolute top-1 w-[18px] h-[18px] bg-white rounded-full transition-transform ${darkMode ? 'left-[26px]' : 'left-1'}`} />
              </button>
            </div>

          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-4 pt-4">
          <button onClick={() => showComingSoon("Saving account changes")} className="h-[48px] px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold rounded-full transition-colors shadow-sm text-[15px] cursor-pointer">
            Save changes
          </button>
          <button className="h-[48px] px-8 bg-transparent border border-border/80 text-foreground font-bold rounded-full transition-colors text-[15px] hover:bg-accent/50 cursor-pointer">
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
