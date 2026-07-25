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

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/sessions", label: "Sessions", icon: ClipboardList },
  { href: "/rbt", label: "RBT Supervision", icon: UserCheck },
  { href: "/notes", label: "Case Notes", icon: FileText },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-brand-100/50 bg-sidebar-gradient shadow-soft">
      <div className="border-b border-brand-100/40 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-brand-800">
              AMY
            </h1>
            <p className="text-xs font-medium text-brand-500/80">Client Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white/70 text-brand-700 shadow-soft"
                  : "text-stone-600 hover:bg-white/50 hover:text-brand-600"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-brand-100 text-brand-600"
                    : "bg-stone-100/80 text-stone-500 group-hover:bg-brand-50 group-hover:text-brand-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-brand-100/40 p-5">
        <p className="text-xs leading-relaxed text-stone-400">
          Your calm space for clients, authorizations, and supervision.
        </p>
      </div>
    </aside>
  );
}
