import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { Archive, ArrowLeft, Plus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { AuthorizationCard } from "@/components/AuthorizationCard";
import { getAge, SERVICE_LABELS, formatDuration } from "@/lib/utils";
import type { AuthorizationStats } from "@/lib/calculations";

interface ClientDetail {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
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
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (id) amyFetch(`/clients/${id}`).then(setClient);
  };

  useEffect(() => {
    load();
  }, [id]);

  async function handleArchive() {
    if (!client || !id) return;
    if (
      !confirm(
        "Archive this client? They will be hidden from the dashboard and session dropdowns. All history is kept.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await amyFetch(`/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    if (!id) return;
    setBusy(true);
    try {
      await amyFetch(`/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!client || !id) return;
    const typed = prompt(
      `Permanently delete ${client.name} and ALL sessions and case notes?\n\nType the client's last name to confirm:`,
      "",
    );
    if (typed?.trim().toLowerCase() !== client.lastName.trim().toLowerCase()) {
      if (typed !== null) alert("Deletion cancelled — last name did not match.");
      return;
    }
    setBusy(true);
    try {
      await amyFetch(`/clients/${id}`, { method: "DELETE" });
      navigate("/clients");
    } finally {
      setBusy(false);
    }
  }

  if (!client) return <div className="muted-text">Loading...</div>;

  const age = getAge(client.dateOfBirth ? new Date(client.dateOfBirth) : null);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            to="/clients"
            className="mb-4 inline-flex items-center gap-1 text-sm muted-text hover:text-brand-600 dark:hover:text-brand-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Link>
          <h1 className="page-title">{client.name}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm muted-text">
            {age !== null && <span>Age {age}</span>}
            {client.diagnosis && <span>{client.diagnosis}</span>}
            {!client.isActive && (
              <span className="rounded-full surface-muted px-2 py-0.5 text-xs">Archived</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/clients/${id}/edit`} className="btn-secondary gap-2">
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          {client.isActive ? (
            <>
              <Link to={`/sessions/new?clientId=${id}`} className="btn-primary gap-2">
                <Plus className="h-4 w-4" />
                Log Session
              </Link>
              <button type="button" disabled={busy} onClick={handleArchive} className="btn-secondary gap-2">
                <Archive className="h-4 w-4" />
                Archive
              </button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={handleRestore} className="btn-secondary gap-2">
              <RotateCcw className="h-4 w-4" />
              Restore
            </button>
          )}
          <button type="button" disabled={busy} onClick={handleDelete} className="btn-danger gap-2">
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {!client.isActive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This client is archived. Restore them to log new sessions or show on the dashboard.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <h2 className="section-title mb-4">Client Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="muted-text">Insurance Provider</dt>
              <dd className="font-medium">{client.insuranceProvider || "—"}</dd>
            </div>
            <div>
              <dt className="muted-text">Member ID</dt>
              <dd className="font-medium">{client.insuranceId || "—"}</dd>
            </div>
            <div>
              <dt className="muted-text">Authorization Start</dt>
              <dd className="font-medium">
                {client.authorizationStart
                  ? format(new Date(client.authorizationStart), "MMM d, yyyy")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="muted-text">Authorization End</dt>
              <dd className="font-medium">
                {client.authorizationEnd
                  ? format(new Date(client.authorizationEnd), "MMM d, yyyy")
                  : "—"}
                {client.daysUntilExpiration !== null && client.daysUntilExpiration <= 30 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    ({client.daysUntilExpiration} days left)
                  </span>
                )}
              </dd>
            </div>
            {client.notes && (
              <div>
                <dt className="muted-text">Notes</dt>
                <dd className="font-medium whitespace-pre-wrap">{client.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="lg:col-span-2">
          <h2 className="section-title mb-4">Authorization Tracking</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {client.authorizations.map((auth) => (
              <AuthorizationCard key={auth.serviceType} stats={auth} />
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Recent Sessions</h2>
          <Link to={`/sessions?clientId=${id}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            View all
          </Link>
        </div>
        {client.sessions.length === 0 ? (
          <div className="card p-8 text-center muted-text">No sessions logged yet.</div>
        ) : (
          <div className="card divide-y divide-brand-50 dark:divide-stone-800">
            {client.sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium">{SERVICE_LABELS[session.serviceType]}</p>
                  <p className="text-sm muted-text">
                    {format(new Date(session.date), "MMM d, yyyy")}
                    {session.rbt && ` · RBT: ${session.rbt.firstName} ${session.rbt.lastName}`}
                  </p>
                  {session.notes && (
                    <p className="mt-1 text-sm muted-text line-clamp-1">{session.notes}</p>
                  )}
                </div>
                <span className="text-sm font-medium">{formatDuration(session.durationMinutes, "HOURS")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Case Notes</h2>
          {client.isActive && (
            <Link to={`/notes/new?clientId=${id}`} className="btn-secondary gap-2 text-sm">
              <Plus className="h-4 w-4" />
              Add Note
            </Link>
          )}
        </div>
        {client.caseNotes.length === 0 ? (
          <div className="card p-8 text-center muted-text">No case notes yet.</div>
        ) : (
          <div className="card divide-y divide-brand-50 dark:divide-stone-800">
            {client.caseNotes.slice(0, 5).map((note) => (
              <div key={note.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{note.title || "Untitled Note"}</p>
                  <span className="text-xs muted-text">{format(new Date(note.date), "MMM d, yyyy")}</span>
                </div>
                <p className="mt-1 text-sm muted-text line-clamp-2 whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
