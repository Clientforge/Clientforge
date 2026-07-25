import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { WorkScheduleInput } from "@/components/WorkScheduleInput";
import { amyFetch } from "@/lib/api";

export function NewRbtPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    await amyFetch("/rbt", {
      method: "POST",
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email") || null,
        workSchedule: form.get("workSchedule"),
        supervisionPercentage: parseFloat(form.get("supervisionPercentage") as string) || 5,
      }),
    });

    navigate("/rbt");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/rbt" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to RBT Supervision
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add RBT</h1>
        <p className="mt-1 text-slate-500">
          Enter work schedule and supervision percentage — required hours are calculated automatically
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">RBT Information</legend>
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
            <label className="label-field" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="input-field" />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Work Schedule</legend>
          <WorkScheduleInput />
        </fieldset>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Add RBT"}
          </button>
          <Link to="/rbt" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
