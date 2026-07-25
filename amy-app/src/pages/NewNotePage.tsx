import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { amyFetch } from "@/lib/api";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function NewNotePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClient = searchParams.get("clientId") ?? "";

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    amyFetch("/clients?simple=true").then(setClients);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const note = await amyFetch("/notes", {
      method: "POST",
      body: JSON.stringify({
        clientId: form.get("clientId"),
        date: form.get("date"),
        title: form.get("title") || null,
        content: form.get("content"),
      }),
    });

    navigate(`/notes?clientId=${note.clientId}`);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/notes" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Case Notes
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Add Case Note</h1>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        <div>
          <label className="label-field" htmlFor="clientId">Client *</label>
          <select id="clientId" name="clientId" required defaultValue={preselectedClient} className="input-field">
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-field" htmlFor="date">Date *</label>
          <input id="date" name="date" type="date" required defaultValue={today} className="input-field" />
        </div>

        <div>
          <label className="label-field" htmlFor="title">Title</label>
          <input id="title" name="title" className="input-field" placeholder="Optional title" />
        </div>

        <div>
          <label className="label-field" htmlFor="content">Note *</label>
          <textarea id="content" name="content" rows={6} required className="input-field" placeholder="Enter case note..." />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Save Note"}
          </button>
          <Link to="/notes" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
