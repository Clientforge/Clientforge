import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Plus, ChevronRight } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { getAge, formatAuthorizationBreakdown, SERVICE_COLORS } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/PageHeader";
import type { AuthorizationStats } from "@/lib/calculations";

interface ClientRow {
  id: string;
  name: string;
  dateOfBirth?: string | null;
  diagnosis?: string | null;
  insuranceProvider?: string | null;
  authorizationEnd?: string | null;
  isActive: boolean;
  authorizations: AuthorizationStats[];
}

export function ClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    amyFetch("/clients").then(setClients).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-stone-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage client records and authorization units"
        action={
          <Link to="/clients/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        }
      />

      {clients.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <p className="text-stone-500">No clients found. Add your first client to get started.</p>
        </div>
      ) : (
        <div className="card overflow-hidden rounded-2xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-100/60 bg-brand-50/50 text-left text-xs font-medium uppercase tracking-wider text-stone-500">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Diagnosis</th>
                <th className="px-6 py-3">Insurance</th>
                <th className="px-6 py-3">Auth Expires</th>
                <th className="px-6 py-3">Supervision</th>
                <th className="px-6 py-3">Assessments</th>
                <th className="px-6 py-3">Parent Training</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {clients.map((client) => {
                const age = getAge(client.dateOfBirth ? new Date(client.dateOfBirth) : null);
                return (
                  <tr key={client.id} className="transition-colors hover:bg-brand-50/30">
                    <td className="px-6 py-4">
                      <Link to={`/clients/${client.id}`} className="group">
                        <p className="font-medium text-stone-800 group-hover:text-brand-600">{client.name}</p>
                        {age !== null && <p className="text-xs text-stone-400">Age {age}</p>}
                        {!client.isActive && (
                          <span className="mt-1 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                            Inactive
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-600">{client.diagnosis || "—"}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">{client.insuranceProvider || "—"}</td>
                    <td className="px-6 py-4 text-sm text-stone-600">
                      {client.authorizationEnd ? format(new Date(client.authorizationEnd), "MMM d, yyyy") : "—"}
                    </td>
                    {client.authorizations.map((auth) => (
                      <td key={auth.serviceType} className="px-6 py-4">
                        <div className="min-w-[100px]">
                          <p className="mb-1 text-xs text-stone-400">
                            {formatAuthorizationBreakdown(auth.remainingMinutes).shortLabel} left
                          </p>
                          <ProgressBar
                            percent={auth.percentUsed}
                            color={SERVICE_COLORS[auth.serviceType]}
                            size="sm"
                            showLabel={false}
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-6 py-4">
                      <Link to={`/clients/${client.id}`} className="text-stone-300 transition-colors hover:text-brand-500">
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
