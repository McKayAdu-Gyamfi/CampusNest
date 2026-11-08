import { MapPin, Wallet, BedDouble, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  image: string;
  hostelName: string;
  location: string;
  roomLabel: string;
  price: number;
}

/** The hostel + room the student is booking, shown at the top of the booking steps. */
export default function SelectedUnitCard({ image, hostelName, location, roomLabel, price }: Props) {
  const stats = [
    { icon: BedDouble, label: "Room", value: roomLabel },
    { icon: Wallet, label: "Per semester", value: `GHS ${price.toLocaleString()}` },
    { icon: CalendarDays, label: "Stay", value: "16 weeks" },
  ];
  return (
    <Card className="bg-card border border-border/80 shadow-[0_4px_25px_rgba(0,0,0,0.03)] rounded-2xl overflow-hidden p-0 gap-0 transition-colors">
      <div className="relative h-52 sm:h-60 w-full">
        <img src={image} alt={hostelName} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <Badge className="absolute top-4 left-4 bg-white/90 text-primary border-none text-[10px] px-3 py-1 tracking-wider uppercase font-bold shadow-sm">
          {roomLabel}
        </Badge>
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <h3 className="font-extrabold text-2xl tracking-tight leading-tight drop-shadow-sm">{hostelName}</h3>
          <p className="text-sm font-semibold flex items-center mt-1 text-white/90">
            <MapPin className="w-4 h-4 mr-1" /> {location}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-border/60">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="px-4 py-4 flex flex-col items-center text-center min-w-0">
            <Icon className="w-4 h-4 text-primary mb-1.5" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</span>
            <span className="text-[13px] font-extrabold text-foreground mt-0.5 truncate max-w-full">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
