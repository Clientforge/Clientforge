import { cn } from "@/lib/utils";
import { AuthorizationStats } from "@/lib/calculations";
import {
  formatAuthorizationBreakdown,
  SERVICE_COLORS,
  SERVICE_DOT_COLORS,
  SERVICE_LABELS,
} from "@/lib/utils";
import { ProgressBar } from "./ProgressBar";

interface AuthorizationCardProps {
  stats: AuthorizationStats;
  compact?: boolean;
}

function AuthValue({ minutes }: { minutes: number }) {
  const breakdown = formatAuthorizationBreakdown(minutes);
  return (
    <div>
      <p className="font-semibold text-stone-800">
        {breakdown.units} unit{breakdown.units === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-stone-400">
        {breakdown.minutes.toLocaleString()} min · {breakdown.hours} hrs
      </p>
    </div>
  );
}

export function AuthorizationCard({ stats, compact = false }: AuthorizationCardProps) {
  const color = SERVICE_COLORS[stats.serviceType] ?? "from-brand-400 to-brand-500";
  const dotColor = SERVICE_DOT_COLORS[stats.serviceType] ?? "bg-brand-400";
  const remaining = formatAuthorizationBreakdown(stats.remainingMinutes);

  if (compact) {
    return (
      <div className="space-y-2 rounded-xl bg-brand-50/50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-stone-700">
            {SERVICE_LABELS[stats.serviceType]}
          </span>
          <span className="text-stone-500">
            {remaining.units} units left ({remaining.hours} hrs)
          </span>
        </div>
        <ProgressBar percent={stats.percentUsed} color={color} size="sm" showLabel={false} />
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className={cn("h-3 w-3 rounded-full", dotColor)} />
        <h3 className="font-display text-lg font-semibold text-stone-900">
          {SERVICE_LABELS[stats.serviceType]}
        </h3>
      </div>

      <ProgressBar percent={stats.percentUsed} color={color} />

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-stone-400">Authorized</p>
          <AuthValue minutes={stats.authorizedMinutes} />
        </div>
        <div>
          <p className="text-stone-400">Used</p>
          <AuthValue minutes={stats.usedMinutes} />
        </div>
        <div>
          <p className="text-stone-400">Remaining</p>
          <div>
            <p className="font-semibold text-emerald-600">
              {remaining.units} unit{remaining.units === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-emerald-500/80">
              {remaining.minutes.toLocaleString()} min · {remaining.hours} hrs
            </p>
          </div>
        </div>
        <div>
          <p className="text-stone-400">Remaining %</p>
          <p className="font-semibold text-stone-800">{stats.percentRemaining}%</p>
        </div>
      </div>
    </div>
  );
}
