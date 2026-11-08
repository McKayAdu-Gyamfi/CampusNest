import { useMemo, useSyncExternalStore } from "react";
import { useHostels } from "@/contexts/HostelsContext";

const KEY = "saved_hostels";
const EVENT = "saved-hostels-changed";

export function getSavedIds(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Saves the list and tells every open component (e.g. the nav badge). */
export function setSavedIds(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};
const snapshot = () => localStorage.getItem(KEY) ?? "[]";

/** How many saved hostels still exist: matches what the Saved page lists. */
export function useSavedCount(): number {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const { allHostels } = useHostels();
  return useMemo(() => {
    let ids: string[] = [];
    try { const v = JSON.parse(raw); ids = Array.isArray(v) ? v : []; } catch { /* ignore */ }
    if (allHostels.length === 0) return ids.length; // catalogue still loading
    const known = new Set(allHostels.map((h) => h.id));
    return ids.filter((id) => known.has(id)).length;
  }, [raw, allHostels]);
}
