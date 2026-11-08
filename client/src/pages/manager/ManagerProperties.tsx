import { useEffect, useState } from "react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ChevronRight, MapPin, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/adminApi";
import { listManagerHostels, type ManagerHostel } from "@/lib/managerHostels";

export default function ManagerProperties() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [properties, setProperties] = useState<ManagerHostel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    listManagerHostels(user.id).then(setProperties).catch((e) => setError(errorMessage(e)));
  }, [user?.id]);

  // "Add room" from the dashboard: with a single property, go straight to its room form.
  if (params.get("addRoom") && properties?.length === 1) {
    return <Navigate to={`/manager/properties/${properties[0].id}?addRoom=1`} replace />;
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#F0EFEA] pb-20">
      <div className="px-5 lg:px-8 pt-10 pb-6 sticky top-0 bg-[#F0EFEA]/90 backdrop-blur-md z-40 border-b border-solid border-[#E5D0BA]/50 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-[22px] font-bold text-[#463C38]">My properties</h1>
          {properties && (
            <p className="text-[13px] font-medium text-[#8C8279] mt-0.5">
              {properties.length} {properties.length === 1 ? "property" : "properties"} · tap one to manage it
            </p>
          )}
        </div>
        <NotificationsDropdown />
      </div>

      <div className="px-5 lg:px-8">
        {error && <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">{error}</div>}
        {!properties && !error && <p className="text-sm font-medium text-[#8C8279]">Loading…</p>}
        {properties?.length === 0 && <p className="text-sm font-medium text-[#8C8279]">You don't have any approved properties yet.</p>}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties?.map((p) => (
            <Link
              key={p.id}
              to={`/manager/properties/${p.id}`}
              className="group bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="h-44 bg-[#E5D0BA] overflow-hidden">
                {p.images[0] && (
                  <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[18px] font-bold text-[#463C38]">{p.name}</h2>
                  <span className="flex items-center space-x-1 bg-[#FDF3E7] text-[#A84A1A] px-2 py-0.5 rounded-full text-[12px] font-bold shrink-0">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{p.rating.toFixed(1)}</span>
                  </span>
                </div>
                <p className="flex items-center text-[13px] font-medium text-[#8C8279] mt-1">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  {p.location}
                </p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F0EFEA]">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#A29A91]">From</span>
                    <p className="font-bold text-[#463C38]">
                      GHS {p.sharedPrice.toLocaleString("en-GH")}
                      <span className="text-[12px] font-medium text-[#8C8279]"> /semester</span>
                    </p>
                  </div>
                  <span className="flex items-center text-[13px] font-bold text-[#A84A1A]">
                    Manage <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
