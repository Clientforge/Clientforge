import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileText,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/lib/theme";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sessions", label: "Sessions", icon: ClipboardList },
  { href: "/rbt", label: "RBT Supervision", icon: UserCheck },
  { href: "/notes", label: "Case Notes", icon: FileText },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-stone-900/40 backdrop-blur-[1px] md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col border-r border-brand-100/50 bg-sidebar-gradient shadow-soft transition-transform duration-200 ease-out dark:border-stone-800 dark:bg-sidebar-gradient-dark md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="border-b border-brand-100/40 px-6 py-6 dark:border-stone-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-brand-800 dark:text-brand-300">
                AMY
              </h1>
              <p className="text-xs font-medium text-brand-500/80 dark:text-brand-400/80">
                Client Management
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <Link
                key={href}
                to={href}
                onClick={onClose}
                className={cn(
                  "group flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-white/70 text-brand-700 shadow-soft dark:bg-stone-800/80 dark:text-brand-300"
                    : "text-stone-600 hover:bg-white/50 hover:text-brand-600 dark:text-stone-400 dark:hover:bg-stone-800/50 dark:hover:text-brand-300",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-brand-100 text-brand-600 dark:bg-brand-950 dark:text-brand-400"
                      : "bg-stone-100/80 text-stone-500 group-hover:bg-brand-50 group-hover:text-brand-500 dark:bg-stone-800 dark:text-stone-400 dark:group-hover:bg-stone-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-brand-100/40 p-4 dark:border-stone-800">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">Theme</span>
            <ThemeToggle />
          </div>
          <p className="hidden text-xs leading-relaxed text-stone-400 md:block dark:text-stone-500">
            Your calm space for clients, authorizations, and supervision.
          </p>
        </div>
      </aside>
    </>
  );
}

export function MobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-brand-100/50 bg-white/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90 md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onOpenMenu}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brand-100 bg-white text-brand-700 shadow-soft dark:border-stone-700 dark:bg-stone-800 dark:text-brand-300"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold text-brand-800 dark:text-brand-300">AMY</p>
        <p className="text-xs text-brand-500/80 dark:text-brand-400/80">Client Management</p>
      </div>
      <ThemeToggle />
    </header>
  );
}

export function useMobileSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return {
    mobileOpen,
    openMobileMenu: () => setMobileOpen(true),
    closeMobileMenu: () => setMobileOpen(false),
  };
}
