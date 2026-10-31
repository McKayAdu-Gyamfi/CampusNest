import { GraduationCap, FileText, BedDouble, Banknote, Bell, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const chartMonths = [
    { month: "Jan", height: "40%" },
    { month: "Feb", height: "55%" },
    { month: "Mar", height: "45%" },
    { month: "Apr", height: "70%" },
    { month: "May", height: "65%" },
    { month: "Jun", height: "80%" },
    { month: "Jul", height: "95%", active: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-solid border-border/80">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Platform overview</h1>
          <p className="text-[13px] text-muted-foreground font-medium">Spring term 2026 · updated 5 min ago</p>
        </div>
        <button className="w-12 h-12 bg-card border border-border/50 rounded-full flex items-center justify-center relative shadow-sm hover:bg-accent transition-colors cursor-pointer">
          <Bell className="w-5 h-5 text-[#5E5B58]" />
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F4EE] flex items-center justify-center text-[#C56A30]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center">
              ▲ +8%
            </span>
          </div>
          <p className="text-[28px] font-extrabold text-foreground leading-tight">3,412</p>
          <p className="text-[13px] font-medium text-muted-foreground">Students</p>
        </div>

        {/* Card 2 */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F4EE] flex items-center justify-center text-[#C56A30]">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center">
              ▲ +5
            </span>
          </div>
          <p className="text-[28px] font-extrabold text-foreground leading-tight">128</p>
          <p className="text-[13px] font-medium text-muted-foreground">Live hostels</p>
        </div>

        {/* Card 3 */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F4EE] flex items-center justify-center text-[#C56A30]">
              <BedDouble className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center">
              ▲ +11%
            </span>
          </div>
          <p className="text-[28px] font-extrabold text-foreground leading-tight">1,940</p>
          <p className="text-[13px] font-medium text-muted-foreground">Bookings · term</p>
        </div>

        {/* Card 4 */}
        <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#F8F4EE] flex items-center justify-center text-[#C56A30]">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center">
              ▲ +14%
            </span>
          </div>
          <p className="text-[28px] font-extrabold text-foreground leading-tight">GHS 4.2M</p>
          <p className="text-[13px] font-medium text-muted-foreground">GMV · term</p>
        </div>
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Volume Chart */}
        <div className="lg:col-span-2 bg-card border border-border/40 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="mb-6">
            <h3 className="font-extrabold text-lg text-foreground">Booking volume</h3>
            <p className="text-[12px] text-muted-foreground font-medium">last 7 months</p>
          </div>
          
          <div className="h-44 w-full flex items-end justify-between px-4 pb-2 pt-6">
            {chartMonths.map((item) => (
              <div key={item.month} className="flex flex-col items-center gap-3 h-full justify-end flex-1">
                <div 
                  className={`w-10 rounded-xl transition-all ${
                    item.active ? "bg-[#C56A30]" : "bg-[#F4ECE3] hover:bg-[#EBE2D8]"
                  }`}
                  style={{ height: item.height }}
                />
                <span className={`text-[12px] font-bold ${item.active ? "text-foreground font-extrabold" : "text-muted-foreground"}`}>
                  {item.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-lg text-foreground">Pending approvals</h3>
            <span className="w-6 h-6 rounded-full bg-[#F5E6D8] text-[#C56A30] font-extrabold text-xs flex items-center justify-center">
              2
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 border border-border/40 rounded-2xl flex items-center justify-between gap-3 bg-[#FAF8F5]">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                  }}
                />
                <div>
                  <h4 className="font-extrabold text-[15px] text-foreground">Sunrise Lodge</h4>
                  <p className="text-[12px] text-muted-foreground font-medium">KNUST · 40 beds</p>
                </div>
              </div>
              <Link to="/admin/hostels" className="px-4 py-2 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shrink-0">
                Review
              </Link>
            </div>

            <div className="p-3.5 border border-border/40 rounded-2xl flex items-center justify-between gap-3 bg-[#FAF8F5]">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                  }}
                />
                <div>
                  <h4 className="font-extrabold text-[15px] text-foreground">Villa Nova</h4>
                  <p className="text-[12px] text-muted-foreground font-medium">UCC · 28 beds</p>
                </div>
              </div>
              <Link to="/admin/hostels" className="px-4 py-2 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shrink-0">
                Review
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Hostels */}
        <div className="lg:col-span-2 bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-lg text-foreground">Top hostels</h3>
            <span className="text-[12px] text-muted-foreground font-medium">by occupancy</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-accent/40 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                  }}
                />
                <div>
                  <h4 className="font-extrabold text-[15px] text-foreground">Dufie Annex</h4>
                  <p className="text-[12px] text-muted-foreground font-medium">Ashesi · 60 beds</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1 text-[#C56A30]">
                  <Star className="w-4 h-4 fill-[#C56A30]" />
                  <span className="font-extrabold text-sm text-foreground">4.8</span>
                </div>
                <span className="font-extrabold text-emerald-600 text-sm">96%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-accent/40 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                  }}
                />
                <div>
                  <h4 className="font-extrabold text-[15px] text-foreground">Palm Court Hostel</h4>
                  <p className="text-[12px] text-muted-foreground font-medium">UG Legon · 84 beds</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1 text-[#C56A30]">
                  <Star className="w-4 h-4 fill-[#C56A30]" />
                  <span className="font-extrabold text-sm text-foreground">4.7</span>
                </div>
                <span className="font-extrabold text-emerald-600 text-sm">92%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-accent/40 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] shrink-0 opacity-80" 
                  style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.4) 6px, rgba(255,255,255,0.4) 8px)'
                  }}
                />
                <div>
                  <h4 className="font-extrabold text-[15px] text-foreground">Legon Heights</h4>
                  <p className="text-[12px] text-muted-foreground font-medium">UG Legon · 120 beds</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-1 text-[#C56A30]">
                  <Star className="w-4 h-4 fill-[#C56A30]" />
                  <span className="font-extrabold text-sm text-foreground">4.5</span>
                </div>
                <span className="font-extrabold text-emerald-600 text-sm">88%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Signups */}
        <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
          <h3 className="font-extrabold text-lg text-foreground mb-5">Recent signups</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#D2BDA7] text-[#5A4535] font-extrabold text-xs flex items-center justify-center shrink-0">
                  AB
                </div>
                <div>
                  <h4 className="font-extrabold text-[14px] text-foreground">Ama Boateng</h4>
                  <p className="text-[11px] text-muted-foreground font-medium">Student · Ashesi</p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">2h</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#5E8B9E] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  DA
                </div>
                <div>
                  <h4 className="font-extrabold text-[14px] text-foreground">Dufie Annex</h4>
                  <p className="text-[11px] text-muted-foreground font-medium">Manager · Ashesi</p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">5h</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#6B8E68] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                  KS
                </div>
                <div>
                  <h4 className="font-extrabold text-[14px] text-foreground">Kobe Sarpong</h4>
                  <p className="text-[11px] text-muted-foreground font-medium">Student · KNUST</p>
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">1d</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
