import { Outlet } from "react-router-dom";
import { MobileHeader, Sidebar, useMobileSidebar } from "@/components/Sidebar";

export function Layout() {
  const { mobileOpen, openMobileMenu, closeMobileMenu } = useMobileSidebar();

  return (
    <div className="min-h-screen bg-page-gradient">
      <Sidebar mobileOpen={mobileOpen} onClose={closeMobileMenu} />
      <div className="min-w-0 md:pl-64">
        <MobileHeader onOpenMenu={openMobileMenu} />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
