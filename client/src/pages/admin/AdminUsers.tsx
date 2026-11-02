import { useState } from "react";
import { Search, MoreHorizontal } from "lucide-react";

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState("Students");
  const [searchQuery, setSearchQuery] = useState("");

  const users = [
    {
      id: 1,
      name: "Ama Boateng",
      email: "ama.b@ashesi.edu.gh",
      avatar: "AB",
      avatarBg: "bg-[#D2BDA7] text-[#5A4535]",
      category: "Student",
      school: "Ashesi",
      joined: "Jul 20",
      status: "Active",
    },
    {
      id: 2,
      name: "Efua Owusu",
      email: "efua.o@ug.edu.gh",
      avatar: "EO",
      avatarBg: "bg-[#6B8E68] text-white",
      category: "Student",
      school: "UG Legon",
      joined: "Jul 18",
      status: "Active",
    },
    {
      id: 3,
      name: "Kwame Owusu",
      email: "kwame.owusu@gmail.com",
      avatar: "KO",
      avatarBg: "bg-[#4A3B32] text-white",
      category: "Manager",
      school: "Ashesi",
      joined: "Aug 23",
      status: "Active",
    },
    {
      id: 4,
      name: "Nana Adjei",
      email: "nana.a@knust.edu.gh",
      avatar: "NA",
      avatarBg: "bg-[#6A5A8E] text-white",
      category: "Student",
      school: "KNUST",
      joined: "Jul 12",
      status: "Suspended",
    },
    {
      id: 5,
      name: "Gifty Tetteh",
      email: "gifty.t@ug.edu.gh",
      avatar: "GT",
      avatarBg: "bg-[#5E8B9E] text-white",
      category: "Student",
      school: "UG Legon",
      joined: "Jul 9",
      status: "Active",
    },
  ];

  const filteredUsers = users.filter((u) => {
    if (activeTab === "Students" && u.category !== "Student") return false;
    if (activeTab === "Managers" && u.category !== "Manager") return false;
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-solid border-border/80">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Users</h1>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-11 pr-4 bg-card border border-border/50 rounded-full text-xs font-medium outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center space-x-8 border-b border-border/50 pb-1 px-2">
        <button 
          onClick={() => setActiveTab("Students")}
          className={`pb-3 font-extrabold text-[15px] relative transition-colors cursor-pointer ${
            activeTab === "Students" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Students <span className="text-muted-foreground font-semibold text-xs ml-1">3,412</span>
          {activeTab === "Students" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C56A30] rounded-full" />
          )}
        </button>

        <button 
          onClick={() => setActiveTab("Managers")}
          className={`pb-3 font-extrabold text-[15px] relative transition-colors cursor-pointer ${
            activeTab === "Managers" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Managers <span className="text-muted-foreground font-semibold text-xs ml-1">96</span>
          {activeTab === "Managers" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C56A30] rounded-full" />
          )}
        </button>

        <button 
          onClick={() => setActiveTab("Admins")}
          className={`pb-3 font-extrabold text-[15px] relative transition-colors cursor-pointer ${
            activeTab === "Admins" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Admins <span className="text-muted-foreground font-semibold text-xs ml-1">4</span>
          {activeTab === "Admins" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C56A30] rounded-full" />
          )}
        </button>
      </div>

      {/* Users Table Card */}
      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase bg-[#FAF8F5]/50">
                <th className="py-4 px-6">User</th>
                <th className="py-4 px-6">Category</th>
                <th className="py-4 px-6">School</th>
                <th className="py-4 px-6">Joined</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full ${u.avatarBg} font-extrabold text-xs flex items-center justify-center shrink-0`}>
                        {u.avatar}
                      </div>
                      <div>
                        <p className="font-extrabold text-[14px] text-foreground leading-tight">{u.name}</p>
                        <p className="text-[12px] text-muted-foreground font-medium">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${
                      u.category === 'Manager' ? 'bg-[#F2EFEA] text-[#8C5B4F]' : 'bg-[#FAF0E6] text-[#C56A30]'
                    }`}>
                      {u.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-[13px] text-foreground/80">
                    {u.school}
                  </td>
                  <td className="py-4 px-6 text-[13px] text-muted-foreground font-medium">
                    {u.joined}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-1.5 font-bold text-[12px]">
                      <span className={`w-2 h-2 rounded-full ${u.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className={u.status === 'Active' ? 'text-emerald-600' : 'text-amber-600'}>
                        {u.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="p-2 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
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
