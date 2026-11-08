import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import HostelDetailsOverlay from "@/components/HostelDetailsOverlay";
import NotFound from "@/pages/NotFound";
import { useHostels } from "@/contexts/HostelsContext";
import { getSavedIds, setSavedIds } from "@/lib/savedHostels";
import { useToast } from "@/components/ui/toaster";
import { ROUTES } from "@/lib/routes";

/** `/hostels/:id`: a shareable, bookmarkable link to one hostel. */
export default function HostelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { allHostels, isLoading } = useHostels();
  const { toast } = useToast();
  const [saved, setSaved] = useState<string[]>(getSavedIds);

  const hostel = allHostels.find((h) => h.id === id);
  if (!hostel) {
    if (isLoading) {
      return <div className="flex h-screen w-full items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
    }
    return <NotFound />;
  }

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate(ROUTES.student.explore, { replace: true }));
  const toggleSave = (e: React.MouseEvent, hostelId: string) => {
    e.stopPropagation();
    const next = saved.includes(hostelId) ? saved.filter((s) => s !== hostelId) : [...saved, hostelId];
    toast(saved.includes(hostelId) ? "Removed from favorites" : "Added to favorites", saved.includes(hostelId) ? "info" : "success");
    setSaved(next);
    setSavedIds(next);
  };

  return (
    <HostelDetailsOverlay
      selectedHostel={hostel}
      setSelectedHostel={(h: unknown) => { if (!h) close(); }}
      savedHostels={saved}
      onSave={toggleSave}
    />
  );
}
