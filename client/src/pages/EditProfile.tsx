import { useState } from "react";
import { ChevronLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
// import { TygerAvatar } from 'tyger-avatar';

const PREFERENCES = [
  "Quiet / Low Noise",
  "Air-Conditioned",
  "Wi-Fi Included",
  "Kitchen Access",
  "Backup Generator"
];

// const AVATARS = [
//   "TrChelsea", "TrEric", "TrSamantha", "TrTorsten", "TrIggy", 
//   "TrFranklin", "TrImran", "TrMaria", "TrRachel", "TrShamila", 
//   "TrAlex", "TrFelix", "TrEnrique", "TrSophia", "TrHarry", 
//   "TrHelen", "TrStu", "TrNancy", "TrChad"
// ];

export default function EditProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userAvatar] = useState<string>(localStorage.getItem("userAvatar") || "TrFelix");
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([
    "Air-Conditioned", 
    "Wi-Fi Included", 
  ]);
  const [bio, setBio] = useState(localStorage.getItem("userBio") || "Jus a chill person merhnnnn...");

  const togglePreference = (pref: string) => {
    if (selectedPrefs.includes(pref)) {
      setSelectedPrefs(selectedPrefs.filter(p => p !== pref));
    } else {
      setSelectedPrefs([...selectedPrefs, pref]);
    }
  };

  const handleSave = () => {
    localStorage.setItem("userBio", bio);
    localStorage.setItem("userPrefs", JSON.stringify(selectedPrefs));
    localStorage.setItem("userAvatar", userAvatar);
    navigate(-1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-20 border-b border-border/50 sticky top-0 bg-background z-50">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-accent rounded-full transition-colors cursor-pointer">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold">Edit Profile</h1>
        <button onClick={handleSave} className="p-2 text-primary font-bold text-sm cursor-pointer hover:bg-primary/10 rounded-lg transition-colors">
          Save
        </button>
      </div>

      <div className="px-6 py-8 flex-1 pb-16">
        
        {/* Avatar Edit */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-[100px] h-[100px] mb-4">
            <div className="w-full h-full rounded-full overflow-hidden bg-accent flex items-center justify-center border-2 border-border shadow-md p-1">
              {/* userAvatar?.startsWith("Tr") ? (
                <TygerAvatar name={userAvatar as any} size="3xl" />
              ) : */}
              {userAvatar?.startsWith("http") ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-[50px] leading-none mb-1">{userAvatar}</span>
              )}
            </div>
            {/* <button 
              onClick={() => setIsAvatarPickerOpen(true)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary hover:bg-primary/90 rounded-full flex items-center justify-center border-2 border-background shadow-lg transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4 text-primary-foreground" />
            </button> */}
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
            <input 
              type="text" 
              key={user?.name}
              defaultValue={user?.name}
              className="w-full h-12 bg-card border border-border/60 rounded-lg px-4 font-semibold text-[13px] focus:outline-none focus:ring-1 ring-primary/50 transition-all shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">University</label>
            <input 
              type="text" 
              defaultValue="Ashesi University"
              className="w-full h-12 bg-card border border-border/60 rounded-lg px-4 font-semibold text-[13px] focus:outline-none focus:ring-1 ring-primary/50 transition-all shadow-sm"
            />
          </div>
          
          <div className="flex space-x-4">
            <div className="space-y-2 flex-1">
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Program</label>
              <input 
                type="text" 
                defaultValue="Computer Science"
                className="w-full h-12 bg-card border border-border/60 rounded-lg px-4 font-semibold text-[13px] focus:outline-none focus:ring-1 ring-primary/50 transition-all shadow-sm"
              />
            </div>
            <div className="space-y-2 w-28">
              <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Level</label>
              <select 
                defaultValue="300"
                className="w-full h-12 bg-card border border-border/60 rounded-lg px-4 font-semibold text-[13px] focus:outline-none focus:ring-1 ring-primary/50 transition-all shadow-sm"
              >
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
                <option value="400">400</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground ml-1">Bio</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full h-24 py-3 bg-card border border-border/60 rounded-lg px-4 font-medium text-[13px] focus:outline-none focus:ring-1 ring-primary/50 transition-all resize-none leading-relaxed shadow-sm"
            />
          </div>

          {/* Separator */}
          <div className="h-px bg-border/50 w-full my-8" />

          {/* Preferences Tags */}
          <div className="space-y-3">
             <div className="ml-1 mb-4">
               <label className="text-[14px] font-extrabold tracking-tight text-foreground">Room Preferences</label>
               <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-relaxed max-w-[280px]">Select the exact amenities that matter most to your comfort so hosts can match you correctly.</p>
             </div>
             
             <div className="flex flex-wrap gap-2.5">
               {PREFERENCES.map(pref => {
                 const isSelected = selectedPrefs.includes(pref);
                 return (
                   <button
                     key={pref}
                     onClick={() => togglePreference(pref)}
                     className={`px-4 py-2 rounded-full text-[11px] font-extrabold transition-all cursor-pointer flex items-center shadow-sm border ${
                       isSelected 
                         ? 'bg-primary border-primary text-primary-foreground hover:bg-primary/90' 
                         : 'bg-card border-border/60 text-muted-foreground hover:border-border hover:bg-accent'
                     }`}
                   >
                     {isSelected && <Check className="w-3 h-3 mr-1.5 stroke-[3px]" />}
                     <span>{pref}</span>
                   </button>
                 );
               })}
             </div>
          </div>

        </div>
      </div>

      {/* Avatar Picker Overlay */}
      {/* {isAvatarPickerOpen && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-[100] flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[20px] font-bold tracking-tight mt-10">Choose Avatar</h2>
            <button onClick={() => setIsAvatarPickerOpen(false)} className="p-2 bg-muted rounded-full hover:bg-accent mt-10">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4 pb-12">
            {AVATARS.map((av, idx) => (
              <button 
                key={idx}
                onClick={() => {
                  setUserAvatar(av);
                  setIsAvatarPickerOpen(false);
                }}
                className={`aspect-square flex items-center justify-center p-1 rounded-xl transition-all duration-300 cursor-pointer overflow-hidden ${
                  userAvatar === av 
                    ? 'bg-primary ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 z-10 shadow-lg' 
                    : 'bg-muted/50 hover:bg-accent border border-border/40'
                }`}
              >
                <TygerAvatar name={av as any} size="xl" />
              </button>
            ))}
          </div>
        </div>
      )} */}

    </div>
  );
}
