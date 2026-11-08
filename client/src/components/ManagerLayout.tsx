import { Outlet, useLocation } from "react-router-dom";
import ManagerBottomNav from "./ManagerBottomNav";
import ManagerSidebar from "./ManagerSidebar";
import { useEffect } from "react";

export default function ManagerLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  const hideBottomNav = pathname.endsWith('/cancel');

  return (
    <div className="flex min-h-screen bg-[#F0EFEA] text-foreground">
      <ManagerSidebar />
      <div className="flex-1 flex flex-col min-h-screen lg:ml-[260px] pb-20 lg:pb-0 relative">
        <main className="flex-1 w-full lg:pr-4">
          <Outlet />
        </main>
        {!hideBottomNav && <ManagerBottomNav />}
      </div>
    </div>
  );
}
