import { Star, Search } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link, useLocation } from "react-router-dom";
import TopNav from "@/components/TopNav";
import FilterModal from "@/components/FilterModal";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import HostelCard from "@/components/HostelCard";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import { useState, useEffect } from "react";
import { useHostels } from "@/contexts/HostelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

const getBadgeStyle = (availability: string) => {
  switch (availability?.toUpperCase()) {
    case 'AVAILABLE': return { bg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 animate-pulse' };
    case 'FULL': return { bg: 'bg-destructive/20 text-destructive dark:text-red-400', dot: 'bg-destructive' };
    default: return { bg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
  }
};

export default function Home() {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
    <div className="flex flex-col min-h-screen bg-background pb-6 transition-colors">
      {/* Mobile Top App Bar */}
      <div className="lg:hidden">
        <TopNav />
      </div>

      {/* Desktop Header */}
      <header className="hidden lg:flex items-center justify-between px-8 pt-6 pb-6 w-full">
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search hostels near Berekuso..." 
            className="w-full h-[52px] pl-12 pr-4 bg-card/60 border border-border/50 rounded-full text-[15px] font-medium outline-none focus:ring-2 focus:ring-[#C56A30]/30 transition-all shadow-sm backdrop-blur-sm"
          />
        </div>
        <div className="flex items-center space-x-4">
          <NotificationsDropdown />
          <Link to="/profile" className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90">
            {getInitials(user?.name || user?.email)}
          </Link>
        </div>
      </header>

      {/* Mobile Hero Section */}
      <section className="lg:hidden px-4 pt-20 pb-4 mb-2">
        <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#8C5B4F] to-[#5c3e35] p-6 text-white shadow-md">
          <div className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,1) 10px, rgba(255,255,255,1) 12px)',
            }}
          />
          <div className="relative z-10">
            <p className="text-[11px] font-extrabold tracking-[0.2em] text-[#C56A30] uppercase mb-2">
              WELCOME BACK
            </p>
            <h1 className="text-white text-[26px] font-extrabold leading-tight tracking-tight mb-5">
              Find your perfect room
            </h1>
            <Link to="/explore" className="inline-flex items-center justify-center h-11 px-7 bg-[#C56A30] hover:bg-[#b05b26] text-white font-extrabold rounded-full transition-colors shadow-sm text-sm cursor-pointer">
              Explore
            </Link>
          </div>
        </div>
      </section>

      {/* Desktop Hero Banner */}
      <section className="hidden lg:block px-8 mb-10">
        <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#6c5e57] to-[#4D4D4D] p-12 flex flex-col justify-center shadow-xl shadow-black/10" style={{ minHeight: '320px' }}>
          {/* Diagonal stripe pattern overlay */}
          <div className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,1) 10px, rgba(255,255,255,1) 12px)',
            }}
          />
          <div className="relative z-10 max-w-xl">
            <p className="text-[12px] font-bold tracking-[0.2em] text-[#C56A30] uppercase mb-3">
              WELCOME BACK, SARAH
            </p>
            <h1 className="text-white text-[48px] font-extrabold leading-[1.1] tracking-tight mb-8">
              Find your perfect room
            </h1>
            <Link to="/explore" className="inline-flex items-center justify-center h-14 px-8 bg-[#C56A30] hover:bg-[#b05b26] text-white font-bold rounded-full transition-colors shadow-lg shadow-black/20 text-[16px] cursor-pointer">
              Explore hostels
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Hostels */}
      <section className="py-2 px-4 lg:px-4">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h3 className="text-xl lg:text-[24px] font-extrabold tracking-tight text-foreground">Featured</h3>
          <Link to="/explore" className="text-sm font-bold text-[#C56A30] hover:underline cursor-pointer">View all</Link>
        </div>
        
        {(isLoading || error || allHostels.length === 0) && (
          <p className="text-muted-foreground text-sm py-4">
            {isLoading ? "Loading hostels..." : error ?? "No hostels available yet."}
          </p>
        )}

        {/* Mobile Vertical Stack */}
        <div className="lg:hidden flex flex-col space-y-4">
          {mostPopular.map((hostel) => (
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

        {/* Desktop Horizontal Scroll */}
        <div className="hidden lg:block">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-4 pb-4 pt-1">
              {mostPopular.map((hostel) => (
                <div key={hostel.id} className="w-[300px] shrink-0 block outline-none cursor-pointer">
                  <HostelCard 
                    hostel={hostel} 
                    onClick={() => setSelectedHostel(hostel)} 
                    onSave={(e) => handleSave(e, hostel.id)}
                    isSaved={savedHostels.includes(hostel.id)}
                    showHeart={true}
                  />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      </section>

      {/* Recommended for you */}
      <section className="px-4 py-2 mt-4 lg:px-8 lg:mt-6 mb-12">
        <h3 className="text-xl lg:text-[24px] font-extrabold tracking-tight text-foreground mb-4 lg:mb-6">Recommended for you</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-6">
          
          {nearbyPlaces.map((hostel) => (
            <div 
              key={hostel.id} 
              onClick={() => setSelectedHostel(hostel)}
              className="bg-card border border-border rounded-lg flex p-3 hover:shadow-md hover:bg-accent/50 transition-all cursor-pointer w-full"
            >
              <div className="w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0">
                <img src={hostel.image} alt={hostel.name} loading="lazy" className="w-full h-full object-cover transition-transform hover:scale-110 duration-700" />
              </div>
              <div className="flex-1 ml-4 py-0.5 flex flex-col justify-between overflow-hidden">
                <div>
                  <h4 className="font-bold text-foreground text-[16px] truncate">{hostel.name}</h4>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-wide truncate">{hostel.distance} away</p>
                </div>
                <div className="flex items-center justify-between">
                  {(() => {
                    const style = getBadgeStyle(hostel.availability);
                    return (
                      <div className={`font-bold text-[8px] px-1.5 py-0.5 rounded-md flex items-center ${style.bg}`}>
                        <span className={`w-1 h-1 rounded-full mr-1 ${style.dot}`} />
                        {hostel.availability}
                      </div>
                    );
                  })()}
                  <div className="flex items-center space-x-1 bg-yellow-400/20 px-2 flex-shrink-0 py-1 rounded-lg">
                    <Star className="w-3.5 h-3.5 text-yellow-600 fill-yellow-600" />
                    <span className="text-sm font-bold text-yellow-700">{hostel.rating.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* Filter Options Modal */}
      <FilterModal 
        isOpen={isFilterOpen} 
        onClose={() => setIsFilterOpen(false)} 
        onApplyFilters={() => {}} 
        initialFilters={{ distance: 10, amenities: [], priceRange: [0, 10000] }}
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
