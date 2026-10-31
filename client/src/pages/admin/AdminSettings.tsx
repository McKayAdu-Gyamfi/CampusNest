import { useState } from "react";
import { Shield } from "lucide-react";

export default function AdminSettings() {
  const [maintenance, setMaintenance] = useState(false);

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-[28px] font-extrabold tracking-tight text-foreground pb-6 mb-6 border-b border-solid border-border/80">Platform settings</h1>

      <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground mb-4">General Configuration</h2>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Platform Name</label>
              <input 
                type="text" 
                defaultValue="KayaCampus"
                className="w-full h-12 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-[#C56A30] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Support Email</label>
              <input 
                type="email" 
                defaultValue="support@kayacampus.com"
                className="w-full h-12 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-sm font-bold text-foreground focus:ring-2 focus:ring-[#C56A30] outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border/40">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground mb-4">System Maintenance</h2>
          
          <div className="flex items-center justify-between p-4 bg-[#FAF8F5] border border-border/40 rounded-2xl">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-[#C56A30]" />
              <div>
                <h4 className="font-extrabold text-sm text-foreground">Maintenance Mode</h4>
                <p className="text-xs text-muted-foreground font-medium">Temporarily disable student booking flow for upgrades</p>
              </div>
            </div>

            <button 
              onClick={() => setMaintenance(!maintenance)}
              className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${maintenance ? 'bg-[#C56A30]' : 'bg-[#D6CFC8]'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${maintenance ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button className="h-11 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm cursor-pointer">
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
