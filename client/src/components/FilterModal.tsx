import { useState, useEffect } from "react";
import { X, Check, RotateCcw } from "lucide-react";

interface Filters { distance: number; amenities: string[]; priceRange: [number, number] }

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: Filters) => void;
  initialFilters: Filters;
}

const AMENITIES = ["WiFi", "AC", "Gym", "Laundry", "Kitchen Shared", "Kitchen Personal"];
const MAX_PRICE = 10000;
const MAX_DISTANCE = 10;

/** Bottom sheet on phones, centred dialog on desktop. */
export default function FilterModal({ isOpen, onClose, onApplyFilters, initialFilters }: FilterModalProps) {
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(initialFilters.amenities);
  const [distance, setDistance] = useState<number>(initialFilters.distance);
  const [priceRange, setPriceRange] = useState<[number, number]>(initialFilters.priceRange || [0, MAX_PRICE]);

  // Lock page scroll and re-sync the form each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSelectedAmenities(initialFilters.amenities);
      setDistance(initialFilters.distance);
      if (initialFilters.priceRange) setPriceRange(initialFilters.priceRange);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [isOpen, initialFilters]);

  // Escape closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const toggleAmenity = (item: string) =>
    setSelectedAmenities((cur) => (cur.includes(item) ? cur.filter((a) => a !== item) : [...cur, item]));

  const handleApply = () => {
    onApplyFilters({
      distance,
      amenities: selectedAmenities,
      priceRange: [priceRange[0], priceRange[1] === 0 ? MAX_PRICE : priceRange[1]],
    });
    onClose();
  };

  const clear = () => { setSelectedAmenities([]); setDistance(MAX_DISTANCE); setPriceRange([0, MAX_PRICE]); };

  const activeCount =
    selectedAmenities.length +
    (distance < MAX_DISTANCE ? 1 : 0) +
    (priceRange[0] > 0 || (priceRange[1] > 0 && priceRange[1] < MAX_PRICE) ? 1 : 0);

  const fill = ((distance - 0.5) / (MAX_DISTANCE - 0.5)) * 100;
  const inputCls =
    "w-full h-12 bg-muted border border-border rounded-xl pl-14 pr-4 text-foreground font-semibold focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-muted-foreground/60";

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className={`fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Positioner: bottom on phones, centre on desktop */}
      <div className="fixed inset-x-0 bottom-0 lg:inset-0 z-[110] flex lg:items-center lg:justify-center pointer-events-none">
        <div
          role="dialog" aria-modal="true" aria-label="Filters" aria-hidden={!isOpen}
          className={`pointer-events-auto w-full lg:max-w-[560px] bg-card text-card-foreground border border-border rounded-t-[32px] lg:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.25)] lg:shadow-2xl flex flex-col max-h-[90dvh] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            isOpen
              ? "translate-y-0 lg:scale-100 opacity-100"
              : "translate-y-full lg:translate-y-0 lg:scale-95 opacity-0 lg:opacity-0 pointer-events-none"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 lg:px-8 pt-6 lg:pt-7 pb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl lg:text-[22px] font-extrabold tracking-tight text-foreground">Filters</h2>
              {activeCount > 0 && (
                <span className="min-w-6 h-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center">{activeCount}</span>
              )}
            </div>
            <button onClick={onClose} aria-label="Close filters" className="w-10 h-10 flex items-center justify-center rounded-full bg-muted hover:bg-accent transition-colors cursor-pointer">
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto hide-scrollbar px-6 lg:px-8 pb-6 space-y-8">

            {/* Distance */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <label htmlFor="filter-distance" className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest">Distance to campus</label>
                <span className="text-sm font-extrabold text-primary">{distance >= MAX_DISTANCE ? "Any distance" : `Within ${distance} km`}</span>
              </div>
              <input
                id="filter-distance" type="range" min="0.5" max={MAX_DISTANCE} step="0.5" value={distance}
                onChange={(e) => setDistance(parseFloat(e.target.value))}
                style={{ background: `linear-gradient(to right, var(--primary) ${fill}%, var(--muted) ${fill}%)` }}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[#C56A30]"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2 font-semibold">
                <span>0.5 km</span><span>10+ km</span>
              </div>
            </section>

            {/* Amenities */}
            <section>
              <h3 className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest mb-4">Amenities</h3>
              <div className="flex flex-wrap gap-2.5">
                {AMENITIES.map((item) => {
                  const on = selectedAmenities.includes(item);
                  return (
                    <button
                      key={item} type="button" aria-pressed={on} onClick={() => toggleAmenity(item)}
                      className={`h-10 px-4 rounded-full text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        on ? "bg-primary border-primary text-primary-foreground shadow-sm" : "bg-muted border-border text-foreground hover:border-primary/50 hover:text-primary"
                      }`}
                    >
                      {on && <Check className="w-4 h-4" strokeWidth={3} />}
                      {item}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Price range */}
            <section>
              <h3 className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-widest mb-4">Price range per semester</h3>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div>
                  <label htmlFor="filter-min" className="text-xs font-bold text-muted-foreground mb-1.5 block">Min</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-muted-foreground">GHS</span>
                    <input
                      id="filter-min" type="number" inputMode="numeric" min={0}
                      value={priceRange[0] === 0 ? "" : priceRange[0]} placeholder="0"
                      onChange={(e) => setPriceRange([e.target.value === "" ? 0 : Number(e.target.value), priceRange[1]])}
                      className={inputCls}
                    />
                  </div>
                </div>
                <span className="pb-3 text-muted-foreground font-bold">–</span>
                <div>
                  <label htmlFor="filter-max" className="text-xs font-bold text-muted-foreground mb-1.5 block">Max</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-muted-foreground">GHS</span>
                    <input
                      id="filter-max" type="number" inputMode="numeric" min={0}
                      value={priceRange[1] === MAX_PRICE || priceRange[1] === 0 ? "" : priceRange[1]} placeholder={String(MAX_PRICE)}
                      onChange={(e) => setPriceRange([priceRange[0], e.target.value === "" ? 0 : Number(e.target.value)])}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-6 lg:px-8 pt-4 pb-8 lg:pb-7 border-t border-border">
            <button
              onClick={clear}
              className="h-12 px-5 rounded-full font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />Clear
            </button>
            <button
              onClick={handleApply}
              className="flex-1 h-12 bg-primary text-primary-foreground rounded-full font-extrabold shadow-sm hover:bg-[#b05b26] active:scale-[0.99] transition-all cursor-pointer"
            >
              Show results
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
