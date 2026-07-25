import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { SERVICE_LABELS, formatDuration } from "@/lib/utils";
import { DeleteSessionButton } from "@/components/DeleteSessionButton";
import { PageHeader } from "@/components/PageHeader";

interface SessionRow {
  id: string;
  clientId: string;
  serviceType: string;
  date: string;
  durationMinutes: number;
  notes?: string | null;
  client: { firstName: string; lastName: string };
  rbt?: { firstName: string; lastName: string } | null;
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function SessionsPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId") ?? undefined;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const qs = clientId ? `?clientId=${clientId}` : "";
    Promise.all([amyFetch(`/sessions${qs}`), amyFetch("/clients?simple=true")])
      .then(([s, c]) => {
        setSessions(s);
        setClients(c);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [clientId]);

  if (loading) return <div className="text-stone-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Session Log"
        subtitle="Log and review supervision, assessment, and parent training sessions"
        action={
          <Link to="/sessions/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Log Session
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          to="/sessions"
          className={`inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            !clientId
              ? "bg-brand-100 text-brand-700 shadow-soft"
              : "border border-brand-100 bg-white/70 text-stone-600 hover:bg-brand-50"
          }`}
        >
          All Clients
        </Link>
        {clients.map((c) => (
          <Link
            key={c.id}
            to={`/sessions?clientId=${c.id}`}
            className={`inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              clientId === c.id
                ? "bg-brand-100 text-brand-700 shadow-soft"
                : "border border-brand-100 bg-white/70 text-stone-600 hover:bg-brand-50"
            }`}
          >
            {c.firstName} {c.lastName}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          No sessions logged yet. Log your first session to start tracking authorization usage.
        </div>
      ) : (
        <div className="card overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-brand-100/60 bg-brand-50/50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Service</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">RBT</th>
                <th className="px-6 py-3">Notes</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {sessions.map((session) => (
                <tr key={session.id} className="transition-colors hover:bg-brand-50/30">
                  <td className="px-6 py-4 text-sm text-stone-800">
                    {format(new Date(session.date), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/clients/${session.clientId}`} className="text-sm font-medium text-brand-600 hover:underline">
                      {session.client.firstName} {session.client.lastName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{SERVICE_LABELS[session.serviceType]}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {formatDuration(session.durationMinutes, "HOURS")}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {session.rbt ? `${session.rbt.firstName} ${session.rbt.lastName}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{session.notes || "—"}</td>
                  <td className="px-6 py-4">
                    <DeleteSessionButton sessionId={session.id} onDeleted={load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
