import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthorizationUnitInput } from "@/components/AuthorizationUnitInput";
import { minutesToUnits } from "@/lib/utils";
import { amyFetch } from "@/lib/api";

const SERVICE_TYPES = [
  { key: "SUPERVISION", label: "Supervision" },
  { key: "ASSESSMENT", label: "Assessments" },
  { key: "PARENT_TRAINING", label: "Parent Training" },
] as const;

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  diagnosis: string | null;
  insuranceProvider: string | null;
  insuranceId: string | null;
  authorizationStart: string | null;
  authorizationEnd: string | null;
  notes: string | null;
  isActive: boolean;
  authorizations: { serviceType: string; authorizedMinutes: number }[];
}

function toInputDate(date: string | null) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

export function EditClientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) amyFetch(`/clients/${id}`).then(setClient).finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const authorizations = SERVICE_TYPES.map(({ key }) => ({
      serviceType: key,
      units: parseFloat(form.get(`${key}_units`) as string) || 0,
    }));

    try {
      await amyFetch(`/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          dateOfBirth: form.get("dateOfBirth") || null,
          diagnosis: form.get("diagnosis") || null,
          insuranceProvider: form.get("insuranceProvider") || null,
          insuranceId: form.get("insuranceId") || null,
          authorizationStart: form.get("authorizationStart") || null,
          authorizationEnd: form.get("authorizationEnd") || null,
          notes: form.get("notes") || null,
          isActive: form.get("isActive") === "on",
          authorizations,
        }),
      });
      navigate(`/clients/${id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;
  if (!client) return <div className="text-red-600">Client not found</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to={`/clients/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Client
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Edit Client</h1>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="firstName">First Name</label>
            <input id="firstName" name="firstName" defaultValue={client.firstName} required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="lastName">Last Name</label>
            <input id="lastName" name="lastName" defaultValue={client.lastName} required className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="dateOfBirth">Date of Birth</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={toInputDate(client.dateOfBirth)} className="input-field" />
        </div>

        <div>
          <label className="label-field" htmlFor="diagnosis">Diagnosis</label>
          <input id="diagnosis" name="diagnosis" defaultValue={client.diagnosis ?? ""} className="input-field" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="insuranceProvider">Insurance Provider</label>
            <input id="insuranceProvider" name="insuranceProvider" defaultValue={client.insuranceProvider ?? ""} className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="insuranceId">Member ID</label>
            <input id="insuranceId" name="insuranceId" defaultValue={client.insuranceId ?? ""} className="input-field" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="authorizationStart">Auth Start</label>
            <input id="authorizationStart" name="authorizationStart" type="date" defaultValue={toInputDate(client.authorizationStart)} className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="authorizationEnd">Auth End</label>
            <input id="authorizationEnd" name="authorizationEnd" type="date" defaultValue={toInputDate(client.authorizationEnd)} className="input-field" />
          </div>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Authorization Units</legend>
          <div className="grid gap-3">
            {SERVICE_TYPES.map(({ key, label }) => {
              const auth = client.authorizations.find((a) => a.serviceType === key);
              const units = auth ? minutesToUnits(auth.authorizedMinutes) : 0;
              return (
                <AuthorizationUnitInput
                  key={key}
                  id={`${key}_units`}
                  name={`${key}_units`}
                  label={label}
                  defaultValue={units}
                />
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="label-field" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={client.notes ?? ""} className="input-field" />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={client.isActive} className="rounded border-slate-300" />
          Active client
        </label>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link to={`/clients/${id}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
