import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "warning" | "success";
}

export function StatCard({ title, value, subtitle, icon, variant = "default" }: StatCardProps) {
  const variants = {
    default: "border-brand-100/60 bg-white/80",
    warning: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-orange-50/50",
    success: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/50",
  };

  const iconVariants = {
    default: "icon-badge",
    warning: "icon-badge-warning",
    success: "icon-badge-success",
  };

  return (
    <div className={cn("card rounded-2xl p-5", variants[variant])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className="mt-1 font-display text-3xl font-semibold text-stone-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-stone-400">{subtitle}</p>}
        </div>
        {icon && <div className={iconVariants[variant]}>{icon}</div>}
      </div>
    </div>
  );
}
