import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { AuthorizationCard } from "@/components/AuthorizationCard";
import { getAge, SERVICE_LABELS, formatDuration } from "@/lib/utils";
import type { AuthorizationStats } from "@/lib/calculations";

interface ClientDetail {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  diagnosis?: string | null;
  insuranceProvider?: string | null;
  insuranceId?: string | null;
  authorizationStart?: string | null;
  authorizationEnd?: string | null;
  notes?: string | null;
  isActive: boolean;
  daysUntilExpiration: number | null;
  authorizations: AuthorizationStats[];
  sessions: {
    id: string;
    serviceType: string;
    date: string;
    durationMinutes: number;
    notes?: string | null;
    rbt?: { firstName: string; lastName: string } | null;
  }[];
  caseNotes: {
    id: string;
    date: string;
    title?: string | null;
    content: string;
  }[];
}

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);

  useEffect(() => {
    if (id) amyFetch(`/clients/${id}`).then(setClient);
  }, [id]);

  if (!client) return <div className="text-stone-500">Loading...</div>;

  const age = getAge(client.dateOfBirth ? new Date(client.dateOfBirth) : null);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{client.name}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
            {age !== null && <span>Age {age}</span>}
            {client.diagnosis && <span>{client.diagnosis}</span>}
            {!client.isActive && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">Inactive</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/clients/${id}/edit`} className="btn-secondary gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <Link to={`/sessions/new?clientId=${id}`} className="btn-primary gap-2">
            <Plus className="h-4 w-4" />
            Log Session
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h2 className="mb-4 font-semibold text-slate-900">Client Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Insurance Provider</dt>
              <dd className="font-medium">{client.insuranceProvider || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Member ID</dt>
              <dd className="font-medium">{client.insuranceId || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Authorization Start</dt>
              <dd className="font-medium">
                {client.authorizationStart
                  ? format(new Date(client.authorizationStart), "MMM d, yyyy")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Authorization End</dt>
              <dd className="font-medium">
                {client.authorizationEnd
                  ? format(new Date(client.authorizationEnd), "MMM d, yyyy")
                  : "—"}
                {client.daysUntilExpiration !== null && client.daysUntilExpiration <= 30 && (
                  <span className="ml-2 text-amber-600">({client.daysUntilExpiration} days left)</span>
                )}
              </dd>
            </div>
            {client.notes && (
              <div>
                <dt className="text-slate-500">Notes</dt>
                <dd className="font-medium whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Authorization Tracking</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {client.authorizations.map((auth) => (
              <AuthorizationCard key={auth.serviceType} stats={auth} />
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Sessions</h2>
          <Link to={`/sessions?clientId=${id}`} className="text-sm text-brand-600 hover:underline">
            View all
          </Link>
        </div>
        {client.sessions.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">No sessions logged yet.</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {client.sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-slate-900">{SERVICE_LABELS[session.serviceType]}</p>
                  <p className="text-sm text-slate-500">
                    {format(new Date(session.date), "MMM d, yyyy")}
                    {session.rbt && ` · RBT: ${session.rbt.firstName} ${session.rbt.lastName}`}
                  </p>
                  {session.notes && (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-1">{session.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {formatDuration(session.durationMinutes, "HOURS")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Case Notes</h2>
          <Link to={`/notes/new?clientId=${id}`} className="btn-secondary gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Add Note
          </Link>
        </div>
        {client.caseNotes.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">No case notes yet.</div>
        ) : (
          <div className="card divide-y divide-slate-100">
            {client.caseNotes.slice(0, 5).map((note) => (
              <div key={note.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{note.title || "Untitled Note"}</p>
                  <span className="text-xs text-slate-500">{format(new Date(note.date), "MMM d, yyyy")}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
