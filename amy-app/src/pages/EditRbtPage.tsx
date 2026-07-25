import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { WorkScheduleInput } from "@/components/WorkScheduleInput";
import { DaySchedule, parseWorkSchedule } from "@/lib/rbt-calculations";
import { amyFetch } from "@/lib/api";

interface RbtData {
  firstName: string;
  lastName: string;
  email: string | null;
  workSchedule: string;
  supervisionPercentage: number;
  isActive: boolean;
}

export function EditRbtPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rbt, setRbt] = useState<RbtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) amyFetch(`/rbt/${id}`).then(setRbt).finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    await amyFetch(`/rbt/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email") || null,
        workSchedule: form.get("workSchedule"),
        supervisionPercentage: parseFloat(form.get("supervisionPercentage") as string) || 5,
        isActive: form.get("isActive") === "on",
      }),
    });

    navigate("/rbt");
  }

  if (loading) return <div className="text-slate-500">Loading...</div>;
  if (!rbt) return <div className="text-red-600">RBT not found</div>;

  const scheduleDefaults = {
    workSchedule: parseWorkSchedule(rbt.workSchedule) as DaySchedule[],
    supervisionPercentage: rbt.supervisionPercentage,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/rbt" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to RBT Supervision
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Edit RBT</h1>

      <form onSubmit={handleSubmit} className="card space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="firstName">First Name</label>
            <input id="firstName" name="firstName" defaultValue={rbt.firstName} required className="input-field" />
          </div>
          <div>
            <label className="label-field" htmlFor="lastName">Last Name</label>
            <input id="lastName" name="lastName" defaultValue={rbt.lastName} required className="input-field" />
          </div>
        </div>

        <div>
          <label className="label-field" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={rbt.email ?? ""} className="input-field" />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900">Work Schedule</legend>
          <WorkScheduleInput defaultValues={scheduleDefaults} />
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={rbt.isActive} className="rounded border-slate-300" />
          Active RBT
        </label>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link to="/rbt" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
