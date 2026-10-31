import { useState } from "react";
import { ChevronLeft, Plus, Move, RotateCcw, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminRoomTours() {
  const [published, setPublished] = useState(true);
  const [selectedScene, setSelectedScene] = useState("Studio · entry");

  const scenes = [
    { id: "studio", name: "Studio · entry", tag: "STUDIO · ENTRY" },
    { id: "bedroom", name: "Bedroom", tag: "BEDROOM" },
    { id: "bathroom", name: "Ensuite bath", tag: "BATHROOM" },
    { id: "kitchenette", name: "Kitchenette", tag: "KITCHENETTE" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-solid border-border/80">
        <div className="flex items-center space-x-3">
          <Link to="/admin/hostels" className="w-10 h-10 rounded-full bg-card border border-border/50 flex items-center justify-center text-foreground hover:bg-accent transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-[24px] font-extrabold tracking-tight text-foreground">Room tour · Dufie Annex</h1>
            <p className="text-[12px] text-muted-foreground font-medium">4 scenes · last edited today</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-extrabold text-foreground">Published</span>
            <button 
              onClick={() => setPublished(!published)}
              className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${published ? 'bg-emerald-600' : 'bg-[#D6CFC8]'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${published ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <button className="h-11 px-6 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold text-xs rounded-full transition-colors shadow-sm cursor-pointer">
            Save tour
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-y-6 lg:gap-x-0">
        {/* Left Column: Scenes Sidebar */}
        <div className="space-y-4 lg:border-r border-border/80 lg:pr-6">
          <h3 className="text-xs font-extrabold tracking-wider text-muted-foreground uppercase">SCENES</h3>
          
          <div className="space-y-3">
            {scenes.map((scene) => {
              const isSelected = selectedScene === scene.name;
              return (
                <div
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.name)}
                  className={`p-3 rounded-[20px] bg-card border transition-all cursor-pointer space-y-2 ${
                    isSelected ? "border-[#C56A30] ring-1 ring-[#C56A30] shadow-sm" : "border-border/40 hover:bg-accent/40"
                  }`}
                >
                  <div 
                    className="w-full h-24 rounded-xl bg-gradient-to-br from-[#D2BDA7] to-[#B09A84] flex items-center justify-center relative overflow-hidden"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.3) 8px, rgba(255,255,255,0.3) 10px)'
                    }}
                  >
                    <span className="px-3 py-1 bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-full text-[10px] font-extrabold tracking-wider text-foreground uppercase">
                      {scene.tag}
                    </span>
                  </div>
                  <p className="font-extrabold text-[13px] text-foreground px-1">{scene.name}</p>
                </div>
              );
            })}

            {/* Dashed Add Scene Button */}
            <button className="w-full h-24 rounded-[20px] border-2 border-dashed border-[#C56A30]/40 hover:border-[#C56A30] bg-[#FAF0E6]/50 flex flex-col items-center justify-center text-[#C56A30] font-extrabold text-xs transition-colors cursor-pointer gap-1">
              <Plus className="w-5 h-5" />
              <span>Add scene</span>
            </button>
          </div>
        </div>

        {/* Right Area: 360 Canvas & Details */}
        <div className="lg:col-span-3 space-y-6 lg:pl-6">
          {/* 360° PREVIEW Canvas */}
          <div 
            className="w-full h-80 rounded-2xl bg-[#E8DDD0] border border-[#D2BDA7]/60 relative overflow-hidden shadow-sm flex items-center justify-center"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 14px, rgba(197, 106, 48, 0.15) 14px, rgba(197, 106, 48, 0.15) 18px)'
            }}
          >
            {/* Top Left Badge */}
            <div className="absolute top-4 left-4 px-3.5 py-2 bg-black/70 backdrop-blur-md text-white rounded-full flex items-center space-x-2 shadow-sm">
              <Move className="w-4 h-4 text-[#C56A30]" />
              <span className="text-xs font-bold">Drag to look around</span>
            </div>

            {/* Center Label */}
            <div className="px-4 py-2 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full shadow-sm">
              <span className="text-[11px] font-extrabold tracking-widest text-foreground uppercase">
                360° PREVIEW — {selectedScene.toUpperCase()}
              </span>
            </div>

            {/* Bottom Control Buttons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center space-x-2">
              <button className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-black transition-colors">
                <Plus className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-black transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scene details */}
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base text-foreground">Scene details</h3>

              <div className="space-y-1.5">
                <label className="text-[12px] font-extrabold text-muted-foreground uppercase">Scene name</label>
                <input 
                  type="text" 
                  value={selectedScene}
                  onChange={(e) => setSelectedScene(e.target.value)}
                  className="w-full h-12 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-extrabold text-muted-foreground uppercase">Linked room</label>
                <div className="relative">
                  <select className="w-full h-12 bg-[#FAF8F5] border border-border/50 rounded-2xl px-4 text-[14px] font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-[#C56A30]">
                    <option>Premium Studio · 402B</option>
                    <option>Standard 2-Bed · 101A</option>
                  </select>
                  <ChevronRight className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Hotspots */}
            <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base text-foreground">Hotspots</h3>

              <div className="space-y-2.5">
                <div className="p-3 bg-[#FAF8F5] border border-border/40 rounded-xl flex items-center justify-between text-xs font-bold text-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#C56A30]" />
                    <span>Go to Bedroom</span>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF8F5] border border-border/40 rounded-xl flex items-center justify-between text-xs font-bold text-foreground">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#C56A30]" />
                    <span>Go to Kitchenette</span>
                  </div>
                </div>

                <button className="inline-flex items-center space-x-1.5 text-xs font-extrabold text-[#C56A30] hover:underline pt-1 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add hotspot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
