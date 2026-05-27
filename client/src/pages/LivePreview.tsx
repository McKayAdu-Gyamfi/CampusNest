import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Maximize, Minimize, X, Hand, Scaling, Ruler, ZoomIn, ZoomOut } from "lucide-react";
import { useBookings } from "@/contexts/BookingContext";

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const summary = location.state;
  const { bookings } = useBookings();
  const hasActiveBooking = bookings.some((b) => b.studentName === "Nana Osei" && (b.status === "Pending" || b.status === "Approved"));

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const tourConfig = {
    default: {
      firstScene: "main_room",
      sceneFadeDuration: 1000,
      autoLoad: true,
      doubleClickZoom: false,
      showZoomCtrl: false,
      showFullscreenCtrl: false
    },
    scenes: {
      main_room: {
        type: "equirectangular",
        panorama: "https://ardent-lobster-343.eu-west-1.convex.cloud/api/storage/daa32b7c-8365-452d-a7d5-b8e04570f5d3",
        hotSpots: [
          {
            pitch: -5,
            yaw: 170,
            type: "scene",
            text: "Go to Bathroom",
            sceneId: "bathroom_1"
          }
        ]
      },
      bathroom_1: {
        type: "equirectangular",
        panorama: "https://clear-tortoise-364.eu-west-1.convex.cloud/api/storage/9074e9bd-4806-4f3e-853b-02e518ceadfa",
        hotSpots: [
          {
            pitch: -5,
            yaw: -90,
            type: "scene",
            text: "Back to Main Room",
            sceneId: "main_room"
          },
          {
            pitch: -5,
            yaw: 90,
            type: "scene",
            text: "Go to bathroom_2",
            sceneId: "bathroom_2"
          }
        ]
      },
      bathroom_2: {
        type: "equirectangular",
        panorama: "https://ardent-lobster-343.eu-west-1.convex.cloud/api/storage/0d061f94-4b5b-497d-86cf-76b4d22aebb1",
        hotSpots: [
          {
            pitch: -5,
            yaw: -120,
            type: "scene",
            text: "Back to Main Room",
            sceneId: "main_room",
          },
          {
            pitch: -5,
            yaw: -90,
            type: "scene",
            text: "Back to bathroom_1",
            sceneId: "bathroom_1"
          }
        ]
      }
    }
  };
  

  const handleClose = () => {
    if (location.state?.returnPath) {
      navigate(location.state.returnPath, { state: { restoreHostel: location.state.returnToHostel }, replace: true });
    } else {
      navigate(-1);
    }
  };

  const handleFullscreen = () => {
    const docEl = document.documentElement as any;
    const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (!isFull) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch((err: any) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  };

  const handleZoomIn = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'zoom_in' }, '*');
  };

  const handleZoomOut = () => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'zoom_out' }, '*');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white">
      {/* Background Room Tour (Pannellum) */}
      <div className="absolute inset-0 z-0 bg-black">
        <iframe 
          ref={iframeRef}
          width="100%" 
          height="100%" 
          allowFullScreen 
          style={{ borderStyle: "none" }} 
          src="/tour.html"
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage({ type: 'pannellum_config', config: tourConfig }, '*');
          }}
        />
      </div>

      {/* Top Left Pills */}
      {!isFullscreen && (
        <div className="absolute top-12 left-4 right-16 z-10 space-y-3 pointer-events-none">
          <div className="inline-flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg pointer-events-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
            <span className="text-sm font-bold tracking-wide text-white">LIVE PREVIEW</span>
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-xl pointer-events-auto">
            <h2 className="text-lg font-bold text-primary mb-1">Premium Studio</h2>
            <p className="text-sm text-white/90 leading-snug">Experience the layout and natural lighting of your future home.</p>
          </div>
        </div>
      )}

      {/* Dimensions Overlay */}
      {!isFullscreen && (
        <div className="absolute top-[220px] left-4 z-10 pointer-events-none animate-in fade-in slide-in-from-left-4 duration-700 delay-500">
          <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-3xl p-4 flex flex-col space-y-4 shadow-2xl relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute -top-10 -right-10 w-20 h-20 bg-primary/20 rounded-full blur-2xl"></div>
            
            <div className="flex items-center space-x-2 text-white mb-2">
              <Ruler className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">Room Dimensions</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-1 bg-black/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/40">Area</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-lg font-bold text-white">250</span>
                  <span className="text-[10px] text-white/60">sq ft</span>
                </div>
              </div>
              <div className="flex flex-col space-y-1 bg-black/40 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] uppercase tracking-wider text-white/40">Ceiling</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-lg font-bold text-white">10</span>
                  <span className="text-[10px] text-white/60">ft</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1 bg-black/40 p-3 rounded-2xl border border-white/5">
              <span className="text-[9px] uppercase tracking-wider text-white/40">Layout (L × W)</span>
              <div className="flex items-center space-x-2 text-white">
                <span className="text-base font-bold">18'</span>
                <X className="w-3 h-3 text-primary/70" />
                <span className="text-base font-bold">14'</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Buttons (Right) */}
      <div className="fixed top-1/2 right-4 -translate-y-1/2 flex flex-col space-y-4 z-[10001] pointer-events-none">
        {!isFullscreen && (
          <button 
            onClick={handleClose} 
            className="w-12 h-12 rounded-full bg-destructive/90 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-destructive transition-colors pointer-events-auto cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button 
          onClick={handleFullscreen} 
          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-black/80 transition-colors pointer-events-auto cursor-pointer"
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
        <button 
          onClick={handleZoomIn} 
          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-black/80 transition-colors pointer-events-auto cursor-pointer"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button 
          onClick={handleZoomOut} 
          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-lg hover:bg-black/80 transition-colors pointer-events-auto cursor-pointer"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
      </div>

      {/* Glass Amenities Card (Right/Top) */}
      {!isFullscreen && summary?.amenities && summary.amenities.length > 0 && (
        <div className="fixed top-6 right-20 sm:top-1/2 sm:right-20 sm:-translate-y-1/2 w-40 sm:w-48 bg-white/10 backdrop-blur-xl border border-white/30 rounded-[24px] p-4 sm:p-5 shadow-2xl animate-in slide-in-from-right-10 duration-700 delay-300 z-[10000]">
          <h3 className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary mb-3 sm:mb-4">Room Features</h3>
          <div className="space-y-2 sm:space-y-3">
            {summary.amenities.slice(0, 5).map((amenity: string, idx: number) => (
              <div key={idx} className="flex items-center space-x-2.5">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <span className="text-[10px] sm:text-[11px] font-bold text-white/90 truncate">{amenity}</span>
              </div>
            ))}
          </div>
          {summary.amenities.length > 5 && (
            <p className="text-[8px] sm:text-[9px] font-bold text-white/40 mt-3 italic">+{summary.amenities.length - 5} more</p>
          )}
        </div>
      )}


      {/* Bottom Interface Group */}
      {!isFullscreen && (
        <div className="absolute bottom-6 left-2 right-2 z-30 flex flex-col items-center">
          
          {/* Interaction Hints */}
          <div className="w-full flex justify-between items-end mb-4 px-2 pointer-events-none">
            <div className="flex bg-black/60 backdrop-blur-md rounded-2xl px-4 py-2 space-x-6 border border-white/20 shadow-lg pointer-events-auto">
              <div className="flex items-center space-x-2">
                <Hand className="w-4 h-4 text-white/90" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Drag to<br/>look</span>
              </div>
              <div className="w-px h-6 bg-white/30 self-center" />
              <div className="flex items-center space-x-2">
                <Scaling className="w-4 h-4 text-white/90" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Pinch<br/>to zoom</span>
              </div>
            </div>
          </div>

          {/* Action Panel & Bottom Nav Wrapper */}
          {/* Using standard background variables here so the panel matches the system theme */}
          <div className="w-full bg-background/95 text-foreground backdrop-blur-xl border border-border rounded-[32px] overflow-hidden shadow-[0_10px_50px_rgba(0,0,0,0.5)] transition-colors">
            <div className="p-4 flex items-center justify-between border-b border-border mx-2">
               <div className="flex flex-col ml-2">
                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Selected Room</span>
                 <div className="flex items-baseline">
                   <span className="text-2xl font-extrabold text-foreground mr-1">GHS {summary?.price?.toLocaleString() || "4,500"}</span>
                   <span className="text-[10px] font-medium text-muted-foreground">/semester</span>
                 </div>
               </div>
               
               <button 
                 disabled={hasActiveBooking}
                 onClick={() => {
                   if (hasActiveBooking) return;
                   if (summary?.price) {
                     navigate('/booking', { state: summary });
                   } else {
                     handleClose();
                   }
                 }}
                 className={`transition-transform px-6 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/30 mr-2 text-center h-full flex flex-col justify-center leading-tight ${
                   hasActiveBooking 
                     ? 'bg-red-500/20 text-red-500 cursor-not-allowed border border-red-500/20'
                     : 'bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground'
                 }`}
               >
                  {hasActiveBooking ? (
                     <span className="text-xs">Active Booking Exists</span>
                  ) : (
                     <span>Book this room</span>
                  )}
               </button>
            </div>


          </div>

        </div>
      )}
    </div>
  );
}
