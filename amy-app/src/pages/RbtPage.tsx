import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { ProgressBar } from "@/components/ProgressBar";
import { formatDuration } from "@/lib/utils";
import { MonthSelector } from "@/components/MonthSelector";
import { PageHeader } from "@/components/PageHeader";

interface RbtStats {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  workScheduleLabel: string;
  scheduleEntries: { label: string; hours: number }[];
  weeklyWorkHours: number;
  monthlyWorkHours: number;
  supervisionPercentage: number;
  requiredHours: number;
  requiredMinutes: number;
  completedMinutes: number;
  remainingHours: number;
  percentCompleted: number;
  sessionCount: number;
  monthlySessions: {
    id: string;
    date: string;
    durationMinutes: number;
    notes: string | null;
    clientName: string;
  }[];
}

interface RbtRow {
  isActive: boolean;
  email: string | null;
  stats: RbtStats;
}

export function RbtPage() {
  const [searchParams] = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);
  const [rbts, setRbts] = useState<RbtRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    amyFetch(`/rbt?year=${year}&month=${month}`)
      .then(setRbts)
      .finally(() => setLoading(false));
  }, [year, month]);

  const monthLabel = format(new Date(year, month), "MMMM yyyy");

  if (loading) return <div className="text-stone-500">Loading...</div>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="RBT Supervision"
        subtitle="Track monthly work hours and automatically calculate required supervision"
        action={
          <Link to="/rbt/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Add RBT
          </Link>
        }
      />

      <MonthSelector />

      {rbts.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center text-stone-500">
          No RBTs added yet. Add an RBT with their work schedule to start tracking.
        </div>
      ) : (
        <div className="space-y-6">
          {rbts.map(({ stats, isActive, email }) => (
            <div key={stats.id} className="card overflow-hidden rounded-2xl">
              <div className="border-b border-brand-100/60 bg-gradient-to-r from-brand-50/80 to-mauve-50/40 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-stone-900">{stats.name}</h3>
                    {email && <p className="text-sm text-stone-500">{email}</p>}
                    <p className="mt-1 text-sm text-slate-600">{stats.workScheduleLabel}</p>
                    {!isActive && (
                      <span className="mt-2 inline-block rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                  <Link to={`/rbt/${stats.id}/edit`} className="text-sm font-medium text-brand-600 hover:underline">
                    Edit Schedule
                  </Link>
                </div>
              </div>

              <div className="p-6">
                <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {monthLabel} Supervision Summary
                </p>

                <ProgressBar percent={stats.percentCompleted} color="from-mauve-400 to-brand-400" />
                <p className="mt-1 text-xs text-slate-500">{stats.percentCompleted}% of required supervision completed</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Weekly Work Hours</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.weeklyWorkHours} hrs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Monthly Work Hours</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.monthlyWorkHours} hrs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Supervision %</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.supervisionPercentage}%</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 p-3">
                    <p className="text-xs text-violet-600">Required Hours</p>
                    <p className="mt-1 text-lg font-bold text-violet-900">{stats.requiredHours} hrs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Completed</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatDuration(stats.completedMinutes, "HOURS")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-600">Remaining</p>
                    <p className="mt-1 text-lg font-bold text-emerald-900">{stats.remainingHours} hrs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Sessions</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{stats.sessionCount}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Supervision Sessions — {monthLabel}</h4>
                  {stats.monthlySessions.length === 0 ? (
                    <p className="text-sm text-slate-500">No supervision sessions logged for this RBT this month.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {stats.monthlySessions.map((session) => (
                        <div key={session.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-slate-900">
                                {format(new Date(session.date), "MMM d, yyyy")}
                                <span className="ml-2 text-sm font-normal text-slate-500">· {session.clientName}</span>
                              </p>
                              {session.notes && <p className="mt-1 text-sm text-slate-600">{session.notes}</p>}
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                              {formatDuration(session.durationMinutes, "HOURS")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
