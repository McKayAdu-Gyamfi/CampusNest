import { useState } from "react";
import { Plus, Bell, Compass, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminHostels() {
  const [hostels, setHostels] = useState([
    {
      id: 1,
      name: "Dufie Annex",
      rating: "4.8",
      location: "Berekuso",
      manager: "Kwame Owusu",
      school: "Ashesi",
      beds: 60,
      roomTour: true,
      status: "Live",
    },
    {
      id: 2,
      name: "Palm Court Hostel",
      rating: "4.7",
      location: "East Legon",
      manager: "Abena Sarpong",
      school: "UG Legon",
      beds: 84,
      roomTour: true,
      status: "Live",
    },
    {
      id: 3,
      name: "Legon Heights",
      rating: "4.5",
      location: "Madina",
      manager: "Yaw Darko",
      school: "UG Legon",
      beds: 120,
      roomTour: false,
      status: "Off",
    },
    {
      id: 4,
      name: "Sunrise Lodge",
      rating: "Pending review",
      location: "Kumasi",
      manager: "Kofi Boadu",
      school: "KNUST",
      beds: 40,
      roomTour: false,
      status: "Pending",
    },
  ]);

  const toggleRoomTour = (id: number) => {
    setHostels(prev => prev.map(h => h.id === id ? { ...h, roomTour: !h.roomTour, status: !h.roomTour ? 'Live' : 'Off' } : h));
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-solid border-border/80">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Hostels</h1>
        <button className="h-11 px-6 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm inline-flex items-center space-x-2 cursor-pointer">
          <Plus className="w-4 h-4" />
          <span>Onboard hostel</span>
        </button>
      </div>

      {/* Alert Queue Banner */}
      <div className="p-4 bg-[#FAF0E6] border border-[#C56A30]/20 rounded-2xl flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-[#C56A30]/10 text-[#C56A30] flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <p className="text-xs lg:text-sm font-bold text-foreground">
            <span className="font-extrabold">2 hostels awaiting approval</span> — review before they go live.
          </p>
        </div>
        <button className="h-9 px-4 bg-white border border-border/50 text-foreground font-extrabold text-xs rounded-full hover:bg-accent transition-colors shadow-sm shrink-0 cursor-pointer">
          Review queue
        </button>
      </div>

      {/* Hostels Table Card */}
      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase bg-[#FAF8F5]/50">
                <th className="py-4 px-6">Hostel</th>
                <th className="py-4 px-6">Manager</th>
                <th className="py-4 px-6">School</th>
                <th className="py-4 px-6">Beds</th>
                <th className="py-4 px-6 text-right">Status / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {hostels.map((h) => (
                <tr key={h.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                        style={{
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                        }}
                      />
                      <div>
                        <p className="font-extrabold text-[15px] text-foreground leading-tight">{h.name}</p>
                        <p className="text-[12px] text-muted-foreground font-medium flex items-center space-x-1 mt-0.5">
                          {h.rating !== 'Pending review' && (
                            <>
                              <Star className="w-3 h-3 fill-[#C56A30] text-[#C56A30]" />
                              <span>{h.rating} · </span>
                            </>
                          )}
                          <span>{h.location}</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-6 font-bold text-[14px] text-foreground/80">
                    {h.manager}
                  </td>

                  <td className="py-4 px-6 text-[13px] text-muted-foreground font-medium">
                    {h.school}
                  </td>

                  <td className="py-4 px-6 text-[14px] font-bold text-foreground">
                    {h.beds}
                  </td>

                  <td className="py-4 px-6 text-right">
                    {h.status === 'Pending' ? (
                      <div className="inline-flex items-center space-x-2">
                        <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/10 text-amber-600">
                          Pending
                        </span>
                        <button className="h-8 px-4 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors cursor-pointer">
                          Review
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center space-x-3">
                        <Link to="/admin/room-tours" className="inline-flex items-center space-x-1 text-xs font-extrabold text-[#C56A30] hover:underline">
                          <Compass className="w-3.5 h-3.5" />
                          <span>Room tour</span>
                        </Link>
                        <span className={`text-xs font-bold ${h.roomTour ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {h.roomTour ? 'Live' : 'Off'}
                        </span>
                        <button 
                          onClick={() => toggleRoomTour(h.id)}
                          className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${h.roomTour ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${h.roomTour ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
