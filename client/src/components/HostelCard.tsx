import { Bookmark, Crown } from "lucide-react";

interface HostelCardProps {
  hostel: any;
  onClick?: () => void;
  onSave?: (e: React.MouseEvent) => void;
  isSaved?: boolean;
  showHeart?: boolean;
  className?: string;
}

export default function HostelCard({ 
  hostel, 
  onClick, 
  onSave, 
  isSaved = false, 
  showHeart = false,
  className = ""
}: HostelCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`w-full bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group relative ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className="relative h-[190px] w-full shrink-0 overflow-hidden bg-muted">
        <img 
          src={hostel.image} 
          alt={hostel.name} 
          loading="lazy" 
          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700" 
        />
        
        {/* Rating Badge Top Left */}
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center space-x-1 shadow-sm">
          <Crown className="w-3.5 h-3.5 text-[#C56A30] fill-[#C56A30]" />
          <span className="text-xs font-extrabold text-white">{hostel.rating.toFixed(1)}</span>
        </div>

        {/* Save / Bookmark Button Top Right */}
        {showHeart && onSave && (
          <button 
            onClick={onSave}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md hover:bg-white transition-colors shadow-sm z-10 cursor-pointer"
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-[#C56A30] text-[#C56A30]' : 'text-gray-500'}`} />
          </button>
        )}
        
        {/* Availability Badge Bottom Left if FULL */}
        {hostel.availability && hostel.availability.toUpperCase() === 'FULL' && (
          <div className="absolute bottom-3 left-3">
            <span className="bg-[#FCE8E6] text-[#C5221F] font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur-md">
              FULL
            </span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between bg-card">
        <div>
          <h4 className="font-extrabold text-foreground text-[18px] truncate mb-0.5 group-hover:text-[#C56A30] transition-colors">
            {hostel.name}
          </h4>
          <p className="text-muted-foreground text-[13px] font-medium truncate mb-3">
            {hostel.location}
          </p>
        </div>
        <div>
          <p className="font-extrabold text-foreground text-[18px]">
            GHS {hostel.startingPrice ? hostel.startingPrice.toLocaleString() : (hostel.price ? hostel.price.toLocaleString() : '6,000')}
            <span className="text-[13px] font-normal text-muted-foreground">/{hostel.priceFreq ? hostel.priceFreq.replace('per ', '') : 'sem'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
