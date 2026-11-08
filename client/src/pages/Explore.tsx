import { Search, SlidersHorizontal, Star } from "lucide-react";
import { setSavedIds } from "@/lib/savedHostels";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import TopNav from "@/components/TopNav";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { useMemo, useState } from "react";
import FilterModal from "@/components/FilterModal";
import { DEFAULT_FILTERS, QUICK_CHIPS, matchesHostelFilters, type HostelFilters } from "@/lib/hostelFilters";
import { DEFAULT_EXPLORE, parseExploreParams, toExploreParams, type ExploreState } from "@/lib/exploreParams";
import { ROUTES } from "@/lib/routes";
import HostelCard from "@/components/HostelCard";
import { useHostels } from "@/contexts/HostelsContext";
import { useAuth } from "@/contexts/AuthContext";
import { getInitials } from "@/lib/utils";
import { useToast } from "@/components/ui/toaster";

export default function Explore() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { mostPopular, nearbyPlaces, isLoading, error } = useHostels();
  const [savedHostels, setSavedHostels] = useState<string[]>(() => {
    const saved = localStorage.getItem("saved_hostels");
    return saved ? JSON.parse(saved) : [];
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Search, chip and filters live in the URL: refresh, share and the back button all keep them.
  const explore = useMemo(() => parseExploreParams(params), [params]);
  const searchQuery = explore.q;
  const activeChip = explore.chip;
  const activeFilters = explore.filters;
  const update = (patch: Partial<ExploreState>) => setParams(toExploreParams({ ...explore, ...patch }), { replace: true });
  const setSearchQuery = (q: string) => update({ q });
  const setActiveChip = (chip: string) => update({ chip });
  const setActiveFilters = (filters: HostelFilters) => update({ filters });
  const openHostel = (id: string) => navigate(ROUTES.student.hostel(id));

  const chipTest = QUICK_CHIPS.find((c) => c.label === activeChip)?.test ?? (() => true);
  const matches = (h: (typeof mostPopular)[number]) => chipTest(h) && matchesHostelFilters(h, activeFilters, searchQuery);
  const filteredPopular = mostPopular.filter(matches);
  const filteredNearby = nearbyPlaces.filter(matches);
  const hasActiveFilters =
    activeChip !== "All" || !!searchQuery ||
    activeFilters.distance !== DEFAULT_FILTERS.distance || activeFilters.amenities.length > 0 ||
    activeFilters.priceRange[0] !== 0 || activeFilters.priceRange[1] !== DEFAULT_FILTERS.priceRange[1];
  const clearAll = () => update(DEFAULT_EXPLORE);

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
    setSavedIds(newSaved);
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
          <Link to={ROUTES.student.profile} className="w-[52px] h-[52px] bg-[#E5D0BA] rounded-full flex items-center justify-center font-bold text-[#6c5e57] shadow-sm text-lg cursor-pointer hover:opacity-90">
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
          {QUICK_CHIPS.map(({ label: chip }) => (
            <button 
              key={chip}
              onClick={() => setActiveChip(chip)}
              className={`px-5 py-2 rounded-full font-extrabold text-[13px] whitespace-nowrap transition-colors cursor-pointer ${
                activeChip === chip
                  ? "bg-[#C56A30] text-white shadow-sm" 
                  : "bg-[#F4ECE3] dark:bg-card text-[#C56A30] hover:bg-[#EBE2D8]"
              }`}
            >
              {chip}
            </button>
          ))}
          {hasActiveFilters && (
            <button onClick={clearAll} className="px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground whitespace-nowrap cursor-pointer">
              Clear all
            </button>
          )}
        </div>

        {/* Most Popular */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Most popular</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPopular.length === 0 && <p className="text-muted-foreground text-sm py-4">{isLoading ? "Loading hostels..." : error ?? "No popular hostels match your filters."}</p>}
            {filteredPopular.map((hostel) => (
              <HostelCard 
                key={hostel.id}
                hostel={hostel} 
                onClick={() => openHostel(hostel.id)} 
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
            {filteredNearby.length === 0 && <p className="text-muted-foreground text-sm py-4">No nearby hostels match your filters.</p>}
            {filteredNearby.map((hostel) => (
              <div 
                key={hostel.id} 
                onClick={() => openHostel(hostel.id)}
                role="link" tabIndex={0}
                onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") openHostel(hostel.id); }}
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
                          isAvailable ? 'bg-[#E6F4EA] dark:bg-emerald-500/15 text-[#137333] dark:text-emerald-400' : 'bg-[#FCE8E6] dark:bg-red-500/15 text-[#C5221F] dark:text-red-400'
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


    </div>
  );
}
