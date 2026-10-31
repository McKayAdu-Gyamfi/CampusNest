import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchHostels, type Hostel } from "@/lib/hostels";

interface HostelsContextValue {
  /** Every approved hostel. */
  allHostels: Hostel[];
  /** Best rated first (ties broken by name). */
  mostPopular: Hostel[];
  /** Closest to campus first. */
  nearbyPlaces: Hostel[];
  isLoading: boolean;
  error: string | null;
}

const HostelsContext = createContext<HostelsContextValue | undefined>(undefined);

const NEARBY_COUNT = 5;

export function HostelsProvider({ children }: { children: ReactNode }) {
  const [allHostels, setAllHostels] = useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHostels()
      .then((hostels) => {
        if (!cancelled) setAllHostels(hostels);
      })
      .catch((err) => {
        console.error("[HostelsProvider] Could not load hostels:", err);
        if (!cancelled) setError("Couldn't load hostels. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<HostelsContextValue>(() => {
    const distanceOf = (h: Hostel) => parseFloat(h.distance);
    return {
      allHostels,
      mostPopular: [...allHostels].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name)),
      nearbyPlaces: [...allHostels].sort((a, b) => distanceOf(a) - distanceOf(b)).slice(0, NEARBY_COUNT),
      isLoading,
      error,
    };
  }, [allHostels, isLoading, error]);

  return <HostelsContext.Provider value={value}>{children}</HostelsContext.Provider>;
}

export function useHostels(): HostelsContextValue {
  const context = useContext(HostelsContext);
  if (context === undefined) {
    throw new Error("useHostels must be used within a HostelsProvider");
  }
  return context;
}
