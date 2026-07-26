import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Plus, ChevronRight } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { getAge, formatAuthorizationBreakdown, SERVICE_COLORS } from "@/lib/utils";
import { ProgressBar } from "@/components/ProgressBar";
import { PageHeader } from "@/components/PageHeader";
import type { AuthorizationStats } from "@/lib/calculations";
import { cn } from "@/lib/utils";

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

type ClientFilter = "active" | "archived" | "all";

const FILTERS: { key: ClientFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = (searchParams.get("filter") as ClientFilter) || "active";
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    amyFetch("/clients").then(setClients).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "archived") return clients.filter((c) => !c.isActive);
    if (filter === "all") return clients;
    return clients.filter((c) => c.isActive);
  }, [clients, filter]);

  function setFilter(next: ClientFilter) {
    const params = new URLSearchParams(searchParams);
    if (next === "active") params.delete("filter");
    else params.set("filter", next);
    setSearchParams(params);
  }

  if (loading) return <div className="muted-text">Loading...</div>;

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

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "inline-flex min-h-[44px] items-center rounded-xl px-4 py-2 text-sm font-medium transition-all",
              filter === key
                ? "bg-brand-100 text-brand-700 shadow-soft dark:bg-brand-950 dark:text-brand-300"
                : "border border-brand-100 bg-white/70 text-stone-600 hover:bg-brand-50 dark:border-stone-700 dark:bg-stone-900/70 dark:text-stone-400 dark:hover:bg-stone-800",
            )}
          >
            {label}
            <span className="ml-2 text-xs opacity-70">
              (
              {key === "active"
                ? clients.filter((c) => c.isActive).length
                : key === "archived"
                  ? clients.filter((c) => !c.isActive).length
                  : clients.length}
              )
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center">
          <p className="muted-text">
            {filter === "archived"
              ? "No archived clients."
              : filter === "active"
                ? "No active clients. Add your first client to get started."
                : "No clients found."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-brand-100/60 bg-brand-50/50 text-left text-xs font-medium uppercase tracking-wider text-stone-500 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-400">
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
              <tbody className="divide-y divide-brand-50 dark:divide-stone-800">
                {filtered.map((client) => {
                  const age = getAge(client.dateOfBirth ? new Date(client.dateOfBirth) : null);
                  return (
                    <tr
                      key={client.id}
                      className={cn(
                        "transition-colors hover:bg-brand-50/30 dark:hover:bg-stone-800/30",
                        !client.isActive && "opacity-75",
                      )}
                    >
                      <td className="px-6 py-4">
                        <Link to={`/clients/${client.id}`} className="group">
                          <p className="font-medium text-stone-800 group-hover:text-brand-600 dark:text-stone-200 dark:group-hover:text-brand-400">
                            {client.name}
                          </p>
                          {age !== null && <p className="text-xs text-stone-400 dark:text-stone-500">Age {age}</p>}
                          {!client.isActive && (
                            <span className="mt-1 inline-block rounded-full surface-muted px-2 py-0.5 text-xs">
                              Archived
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                        {client.diagnosis || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                        {client.insuranceProvider || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                        {client.authorizationEnd ? format(new Date(client.authorizationEnd), "MMM d, yyyy") : "—"}
                      </td>
                      {client.authorizations.map((auth) => (
                        <td key={auth.serviceType} className="px-6 py-4">
                          <div className="min-w-[100px]">
                            <p className="mb-1 text-xs text-stone-400 dark:text-stone-500">
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
                        <Link
                          to={`/clients/${client.id}`}
                          className="text-stone-300 transition-colors hover:text-brand-500 dark:text-stone-600 dark:hover:text-brand-400"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
