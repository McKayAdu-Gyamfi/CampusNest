import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useHostels } from "@/contexts/HostelsContext";
import { Search, SlidersHorizontal, Bookmark, MapPin, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import FilterModal from "@/components/FilterModal";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useToast } from "@/components/ui/toaster";

export default function Saved() {
  const { toast } = useToast();
  const location = useLocation();
  const [savedHostelIds, setSavedHostelIds] = useState<string[]>([]);
  const { allHostels } = useHostels();
  const [selectedHostel, setSelectedHostel] = useState<any>(null);

  useEffect(() => {
    if (location.state?.restoreHostel) {
      const hostel = allHostels.find(h => h.id === location.state.restoreHostel);
      if (hostel) setSelectedHostel(hostel);
    }
  }, [location.state, allHostels]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<{ distance: number; amenities: string[], priceRange: [number, number] }>({ 
    distance: 10, 
    amenities: [], 
    priceRange: [0, 10000] 
  });
  
  useEffect(() => {
    const saved = localStorage.getItem("saved_hostels");
    if (saved) {
      setSavedHostelIds(JSON.parse(saved));
    }
  }, []);

  const handleUnsave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSaved = savedHostelIds.filter(hId => hId !== id);
    setSavedHostelIds(newSaved);
    localStorage.setItem("saved_hostels", JSON.stringify(newSaved));
    toast("Removed from saved", "info");
  };

  const savedHostels = allHostels.filter(h => savedHostelIds.includes(h.id));

  // Apply filtering and search
  const filteredSaved = savedHostels.filter(h => {
    // Search query
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase()) && !h.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Distance filter
    if (parseFloat(h.distance) > activeFilters.distance) return false;
    
    // Price range filter
    if (h.startingPrice < activeFilters.priceRange[0] || h.startingPrice > activeFilters.priceRange[1]) return false;
    
    // Amenities filter
    if (activeFilters.amenities.length > 0 && !activeFilters.amenities.every(a => h.amenities.includes(a))) return false;
    
    return true;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background transition-colors pb-20 relative">
      <div className="lg:hidden">
        <TopNav />
      </div>
      
      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full border-b border-border/40">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Saved</h1>
        <NotificationsDropdown />
      </header>

      <div className="px-5 lg:px-8 space-y-6 pt-24 lg:pt-8">
        <div className="flex items-center justify-between lg:hidden">
          <h1 className="text-2xl font-bold text-foreground">Saved Hostels</h1>
          {savedHostelIds.length > 0 && (
            <span className="bg-[#C56A30]/10 text-[#C56A30] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">{savedHostelIds.length} Saved</span>
          )}
        </div>

        {/* Search & Filter Bar */}
        {savedHostels.length > 0 && (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search your saved list" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-14 bg-card rounded-2xl pl-12 pr-4 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-sm border border-border/50 transition-all"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className="w-14 h-14 flex items-center justify-center bg-card text-foreground rounded-2xl shadow-sm border border-border/50 transition-transform active:scale-95 hover:bg-accent"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>
        )}

        {filteredSaved.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 lg:mt-32">
            <div className={`w-24 h-24 rounded-full bg-[#FDFCFB] flex items-center justify-center mb-6 shadow-sm border border-border/40 ${searchQuery ? 'hidden' : 'flex'}`}>
              <Bookmark className="w-8 h-8 text-[#C56A30]" />
            </div>
            <Search className={`w-16 h-16 text-muted-foreground mb-4 opacity-50 ${searchQuery ? 'block' : 'hidden'}`} />
            
            <h2 className="text-[22px] font-extrabold text-foreground text-center mb-3">
              {searchQuery ? "No results found" : "No saved hostels yet"}
            </h2>
            <p className="text-[15px] font-medium text-muted-foreground text-center max-w-sm mb-8 leading-relaxed">
              {searchQuery ? "Try a different search term or clear filters." : "Tap the heart on any hostel to keep it here. Build your shortlist and compare rooms side by side."}
            </p>
            
            {!searchQuery && (
              <Link to="/explore" className="inline-flex items-center justify-center h-12 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold rounded-full transition-colors shadow-sm text-[15px]">
                <Search className="w-4 h-4 mr-2" />
                Explore hostels
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {filteredSaved.map((hostel) => (
              <div 
                key={hostel.id} 
                onClick={() => setSelectedHostel(hostel)}
                className="w-full bg-card rounded-2xl p-4 shadow-sm border border-border/40 flex items-center justify-between group animate-in fade-in slide-in-from-bottom-4 duration-300 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-4">
                  <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-20 h-20 rounded-[18px] object-cover shadow-sm" />
                  <div className="flex flex-col">
                    <h3 className="font-extrabold text-[16px] text-foreground mb-1">{hostel.name}</h3>
                    <div className="flex items-center text-muted-foreground text-[12px] font-medium mb-1.5">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-[#C56A30]" />
                      <span className="truncate max-w-[160px]">{hostel.location}</span>
                    </div>
                    <div className="flex items-baseline">
                      <span className="text-[#C56A30] font-extrabold text-sm">GHS {(hostel.startingPrice || hostel.price)?.toLocaleString()}</span>
                      <span className="text-muted-foreground text-[10px] font-medium ml-1">/ {hostel.priceFreq || 'sem'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center space-y-2 pr-2">
                  <button 
                    onClick={(e) => handleUnsave(e, hostel.id)}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors shadow-sm cursor-pointer"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <HostelDetailsOverlay 
        selectedHostel={selectedHostel} 
        setSelectedHostel={setSelectedHostel}
        savedHostels={savedHostelIds}
        onSave={handleUnsave}
      />

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={setActiveFilters}
        initialFilters={activeFilters}
      />
    </div>
  );
}
