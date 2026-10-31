import { useState } from "react";
import { Plus, GraduationCap, MapPin } from "lucide-react";

export default function AdminSchools() {
  const [selectedSchool, setSelectedSchool] = useState("Ashesi University");

  const schools = [
    { name: "Ashesi University", hostels: 12, students: 640, location: "Berekuso, Eastern Region" },
    { name: "University of Ghana", hostels: 48, students: 1820, location: "Legon, Accra" },
    { name: "KNUST", hostels: 39, students: 720, location: "Kumasi, Ashanti Region" },
    { name: "UCC", hostels: 18, students: 232, location: "Cape Coast, Central Region" },
  ];

  const schoolHostels = [
    { name: "Dufie Annex", distance: "0.4 km", beds: 60, status: "Live" },
    { name: "Hilltop Residence", distance: "0.8 km", beds: 45, status: "Live" },
    { name: "Berekuso Court", distance: "1.2 km", beds: 32, status: "Off" },
    { name: "Scholars Inn", distance: "1.5 km", beds: 50, status: "Pending" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-solid border-border/80">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Schools</h1>
        <button className="h-11 px-6 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm inline-flex items-center space-x-2 cursor-pointer">
          <Plus className="w-4 h-4" />
          <span>Add school</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-y-6 lg:gap-x-0">
        {/* Left Column: School Selector List */}
        <div className="space-y-3 lg:border-r border-border/80 lg:pr-6">
          {schools.map((school) => {
            const isSelected = selectedSchool === school.name;
            return (
              <div
                key={school.name}
                onClick={() => setSelectedSchool(school.name)}
                className={`p-4 rounded-[20px] transition-all cursor-pointer border flex items-center space-x-4 ${
                  isSelected
                    ? "bg-[#FAF0E6] border-[#C56A30]/40 shadow-sm"
                    : "bg-card border-border/40 hover:bg-accent/40"
                }`}
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  isSelected ? "bg-[#C56A30] text-white" : "bg-[#F8F4EE] text-[#C56A30]"
                }`}>
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[15px] text-foreground">{school.name}</h3>
                  <p className="text-[12px] text-muted-foreground font-medium">
                    {school.hostels} hostels · {school.students} students
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Selected School Details & Map */}
        <div className="lg:col-span-2 space-y-6 lg:pl-6">
          {/* Map Header Box */}
          <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-[22px] font-extrabold text-foreground leading-tight">{selectedSchool}</h2>
              <p className="text-[13px] text-muted-foreground font-medium flex items-center space-x-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#C56A30]" />
                <span>Berekuso, Eastern Region</span>
              </p>
            </div>

            {/* Campus Map Placeholder Graphic */}
            <div 
              className="w-full h-56 rounded-2xl bg-[#E8DDD0] border border-[#D2BDA7]/60 flex items-center justify-center relative overflow-hidden shadow-inner"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(197, 106, 48, 0.15) 12px, rgba(197, 106, 48, 0.15) 16px)'
              }}
            >
              <div className="px-4 py-2 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full shadow-sm">
                <span className="text-[11px] font-extrabold tracking-widest text-[#C56A30] uppercase">
                  CAMPUS MAP — HOSTELS PINNED AROUND ASHESI
                </span>
              </div>
            </div>
          </div>

          {/* Hostels near this school */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-lg text-foreground">Hostels near this school</h3>
              <button className="h-9 px-4 bg-white border border-border/50 text-foreground font-extrabold text-xs rounded-full hover:bg-accent transition-colors shadow-sm inline-flex items-center space-x-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5 text-[#C56A30]" />
                <span>Add hostel</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schoolHostels.map((h) => (
                <div key={h.name} className="p-4 bg-card border border-border/40 rounded-[20px] shadow-sm flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                      style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                      }}
                    />
                    <div>
                      <h4 className="font-extrabold text-[15px] text-foreground">{h.name}</h4>
                      <p className="text-[12px] text-muted-foreground font-medium">{h.distance} · {h.beds} beds</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    h.status === 'Live' ? 'bg-emerald-500/10 text-emerald-600' :
                    h.status === 'Pending' ? 'bg-amber-500/10 text-amber-600' :
                    'bg-gray-500/10 text-gray-500'
                  }`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
