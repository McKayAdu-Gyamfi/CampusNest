import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { titleFor } from "@/lib/pageTitle";

/** Keeps the browser tab title (history, bookmarks, screen readers) in step with the route. */
export default function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titleFor(pathname); }, [pathname]);
  return null;
}
