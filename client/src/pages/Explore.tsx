import { Search, SlidersHorizontal, Star } from "lucide-react";
import { useLocation, Link } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useState, useEffect } from "react";
import FilterModal from "@/components/FilterModal";
import HostelCard from "@/components/HostelCard";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useHostels } from "@/contexts/HostelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

export default function Explore() {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const { allHostels, mostPopular, nearbyPlaces, isLoading, error } = useHostels();
  const [selectedHostel, setSelectedHostel] = useState<any>(null);
  const [savedHostels, setSavedHostels] = useState<string[]>(() => {
    const saved = localStorage.getItem("saved_hostels");
    return saved ? JSON.parse(saved) : [];
  });

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

  const filteredPopular = mostPopular.filter(h => {
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase()) && !h.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (parseFloat(h.distance) > activeFilters.distance) return false;
    if (h.startingPrice < activeFilters.priceRange[0] || h.startingPrice > activeFilters.priceRange[1]) return false;
    if (activeFilters.amenities.length > 0 && !activeFilters.amenities.every(a => h.amenities.includes(a))) return false;
    return true;
  });

  const filteredNearby = nearbyPlaces.filter(h => {
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase()) && !h.location.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (parseFloat(h.distance) > activeFilters.distance) return false;
    if (h.startingPrice < activeFilters.priceRange[0] || h.startingPrice > activeFilters.priceRange[1]) return false;
    if (activeFilters.amenities.length > 0 && !activeFilters.amenities.every(a => h.amenities.includes(a))) return false;
    return true;
  });

  const handleSave = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let newSaved;
    if (savedHostels.includes(id)) {
      newSaved = savedHostels.filter(h => h !== id);
      toast("Removed from favorites", "info");
    } else {
      newSaved = [...savedHostels, id];
      toast("Added to favorites", "success");
    }
    setSavedHostels(newSaved);
    localStorage.setItem("saved_hostels", JSON.stringify(newSaved));
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20 relative">
      {/* Mobile Top App Bar */}
      <div className="lg:hidden">
        <TopNav />
      </div>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full">
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">Explore</h1>
        <div className="flex items-center space-x-4">
          <NotificationsDropdown />
          <Link to="/profile" className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90">
            {getInitials(user?.name || user?.email)}
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-5 lg:px-8 space-y-8 pt-24 lg:pt-0">
        
        {/* Search & Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search address, or near you" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 bg-[#F4ECE3] dark:bg-card rounded-[16px] pl-12 pr-4 text-[15px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-[#C56A30] shadow-none border border-transparent dark:border-border transition-all"
            />
          </div>
          <button 
            onClick={() => setIsFilterOpen(true)}
            className="w-14 h-14 flex items-center justify-center bg-[#C56A30] hover:bg-[#b05b26] text-white rounded-[16px] shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-3 overflow-x-auto pb-2 hide-scrollbar">
          {["All", "Available", "Under GHS 6,500", "Air-conditioned", "Ensuite"].map((chip, idx) => (
            <button 
              key={idx} 
              className={`px-5 py-2 rounded-full font-extrabold text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                idx === 0 
                  ? "bg-[#C56A30] text-white shadow-sm" 
                  : "bg-[#F4ECE3] dark:bg-card text-[#C56A30] hover:bg-[#EBE2D8]"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Most Popular */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Most popular</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPopular.length === 0 && <p className="text-muted-foreground text-sm py-4">{isLoading ? "Loading hostels..." : error ?? "No popular hostels match your search."}</p>}
            {filteredPopular.map((hostel) => (
              <HostelCard 
                key={hostel.id}
                hostel={hostel} 
                onClick={() => setSelectedHostel(hostel)} 
                onSave={(e) => handleSave(e, hostel.id)}
                isSaved={savedHostels.includes(hostel.id)}
                showHeart={true}
              />
            ))}
          </div>
        </div>

        {/* Nearby Place */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Closer to campus</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredNearby.length === 0 && <p className="text-muted-foreground text-sm py-4">No nearby hostels match your search.</p>}
            {filteredNearby.map((hostel) => (
              <div 
                key={hostel.id} 
                onClick={() => setSelectedHostel(hostel)}
                className="w-full bg-card rounded-2xl p-4 flex items-center shadow-sm border border-border/40 cursor-pointer hover:shadow-md transition-all gap-4"
              >
                <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-[110px] h-[110px] rounded-[18px] object-cover shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <h3 className="font-extrabold text-[18px] text-foreground truncate mb-0.5">{hostel.name}</h3>
                  <p className="text-muted-foreground text-[13px] font-medium mb-3 truncate">{hostel.location} · {hostel.distance}</p>
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const isAvailable = hostel.availability?.toUpperCase() === 'AVAILABLE';
                      return (
                        <div className={`font-extrabold text-[11px] px-3 py-1 rounded-full flex items-center space-x-1.5 ${
                          isAvailable ? 'bg-[#E6F4EA] text-[#137333]' : 'bg-[#FCE8E6] text-[#C5221F]'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-[#137333]' : 'bg-[#C5221F]'}`} />
                          <span>{hostel.availability}</span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center space-x-1 shrink-0">
                      <Star className="w-4 h-4 text-[#E09F5E] fill-[#E09F5E]" />
                      <span className="text-[14px] font-bold text-foreground">{hostel.rating.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Filter Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={setActiveFilters}
        initialFilters={activeFilters}
      />

      <HostelDetailsOverlay 
        selectedHostel={selectedHostel} 
        setSelectedHostel={setSelectedHostel}
        savedHostels={savedHostels}
        onSave={handleSave}
      />

    </div>
  );
}
