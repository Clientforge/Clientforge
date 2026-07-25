import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { CaseNotesSearch } from "@/components/CaseNotesSearch";
import { PageHeader } from "@/components/PageHeader";

interface NoteRow {
  id: string;
  clientId: string;
  date: string;
  title?: string | null;
  content: string;
  client: { firstName: string; lastName: string };
}

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function NotesPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("clientId") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (search) params.set("search", search);
    const qs = params.toString() ? `?${params.toString()}` : "";

    Promise.all([amyFetch(`/notes${qs}`), amyFetch("/clients?simple=true")])
      .then(([n, c]) => {
        setNotes(n);
        setClients(c);
      })
      .finally(() => setLoading(false));
  }, [clientId, search]);

  if (loading) return <div className="text-stone-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Case Notes"
        subtitle="Search, review, and organize notes by client or date"
        action={
          <Link to="/notes/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Add Note
          </Link>
        }
      />

      <CaseNotesSearch clients={clients} currentClientId={clientId} currentSearch={search} />

      {notes.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          {search || clientId ? "No notes match your filters." : "No case notes yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Link to={`/clients/${note.clientId}`} className="font-semibold text-brand-600 hover:underline">
                      {note.client.firstName} {note.client.lastName}
                    </Link>
                    <span className="text-sm text-slate-500">{format(new Date(note.date), "MMM d, yyyy")}</span>
                  </div>
                  {note.title && <h3 className="mt-2 font-medium text-slate-900">{note.title}</h3>}
                  <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{note.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
