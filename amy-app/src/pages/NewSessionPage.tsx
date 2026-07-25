import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { amyFetch } from "@/lib/api";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface RbtOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function NewSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClient = searchParams.get("clientId") ?? "";

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rbts, setRbts] = useState<RbtOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serviceType, setServiceType] = useState("SUPERVISION");

  useEffect(() => {
    Promise.all([amyFetch("/clients?simple=true"), amyFetch("/rbt?simple=true")]).then(([c, r]) => {
      setClients(c);
      setRbts(r);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);

    try {
      const session = await amyFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          clientId: form.get("clientId"),
          serviceType: form.get("serviceType"),
          date: form.get("date"),
          duration: parseFloat(form.get("duration") as string),
          unit: form.get("unit"),
          notes: form.get("notes") || null,
          rbtId: form.get("rbtId") || null,
        }),
      });
      navigate(`/clients/${session.clientId}`);
    } catch {
      setError("Failed to log session. Please try again.");
      setLoading(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link to="/sessions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Sessions
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Log Session</h1>
        <p className="mt-1 text-slate-500">Duration will be automatically deducted from the client&apos;s authorization</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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
          <label className="label-field" htmlFor="serviceType">Service Type *</label>
          <select
            id="serviceType"
            name="serviceType"
            required
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="input-field"
          >
            <option value="SUPERVISION">Supervision</option>
            <option value="ASSESSMENT">Assessments</option>
            <option value="PARENT_TRAINING">Parent Training</option>
          </select>
        </div>

        {serviceType === "SUPERVISION" && (
          <div>
            <label className="label-field" htmlFor="rbtId">RBT (optional)</label>
            <select id="rbtId" name="rbtId" className="input-field">
              <option value="">No RBT selected</option>
              {rbts.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.firstName} {r.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label-field" htmlFor="date">Date *</label>
          <input id="date" name="date" type="date" required defaultValue={today} className="input-field" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label-field" htmlFor="duration">Duration *</label>
            <input id="duration" name="duration" type="number" min="0.25" step="0.25" required className="input-field" placeholder="1.5" />
          </div>
          <div>
            <label className="label-field" htmlFor="unit">Unit</label>
            <select id="unit" name="unit" className="input-field">
              <option value="HOURS">Hours</option>
              <option value="MINUTES">Minutes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className="input-field" placeholder="Session notes..." />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Logging..." : "Log Session"}
          </button>
          <Link to="/sessions" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
