import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthorizationUnitInput } from "@/components/AuthorizationUnitInput";
import { amyFetch } from "@/lib/api";

const SERVICE_TYPES = [
  { key: "SUPERVISION", label: "Supervision" },
  { key: "ASSESSMENT", label: "Assessments" },
  { key: "PARENT_TRAINING", label: "Parent Training" },
] as const;

export function NewClientPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const authorizations = SERVICE_TYPES.map(({ key }) => ({
      serviceType: key,
      units: parseFloat(form.get(`${key}_units`) as string) || 0,
    })).filter((a) => a.units > 0);

    try {
      const client = await amyFetch("/clients", {
        method: "POST",
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
          authorizations,
        }),
      });
      navigate(`/clients/${client.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add New Client</h1>
        <p className="mt-1 text-slate-500">Enter client information and authorization units</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Basic Information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="firstName">First Name *</label>
              <input id="firstName" name="firstName" required className="input-field" />
            </div>
            <div>
              <label className="label-field" htmlFor="lastName">Last Name *</label>
              <input id="lastName" name="lastName" required className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field" htmlFor="dateOfBirth">Date of Birth</label>
            <input id="dateOfBirth" name="dateOfBirth" type="date" className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="diagnosis">Diagnosis</label>
            <input id="diagnosis" name="diagnosis" className="input-field" placeholder="e.g. Autism Spectrum Disorder" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Insurance</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="insuranceProvider">Insurance Provider</label>
              <input id="insuranceProvider" name="insuranceProvider" className="input-field" />
            </div>
            <div>
              <label className="label-field" htmlFor="insuranceId">Member / Policy ID</label>
              <input id="insuranceId" name="insuranceId" className="input-field" />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Authorization Period</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-field" htmlFor="authorizationStart">Start Date</label>
              <input id="authorizationStart" name="authorizationStart" type="date" className="input-field" />
            </div>
            <div>
              <label className="label-field" htmlFor="authorizationEnd">End Date</label>
              <input id="authorizationEnd" name="authorizationEnd" type="date" className="input-field" />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Authorization Units</legend>
          <p className="text-xs text-slate-500">
            Enter authorized units for each service type. Each unit equals 15 minutes — the platform
            automatically converts to minutes and hours.
          </p>
          <div className="grid gap-3 sm:grid-cols-1">
            {SERVICE_TYPES.map(({ key, label }) => (
              <AuthorizationUnitInput key={key} id={`${key}_units`} name={`${key}_units`} label={label} />
            ))}
          </div>
        </fieldset>

        <div>
          <label className="label-field" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className="input-field" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Create Client"}
          </button>
          <Link to="/clients" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
