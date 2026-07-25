import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, Users, Calendar, Clock } from "lucide-react";
import { amyFetch } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { AuthorizationCard } from "@/components/AuthorizationCard";
import { PageHeader } from "@/components/PageHeader";
import { formatAuthorizationBreakdown } from "@/lib/utils";
import type { AuthorizationStats } from "@/lib/calculations";

interface DashboardClient {
  id: string;
  name: string;
  diagnosis?: string | null;
  authorizationEnd?: string | null;
  daysUntilExpiration: number | null;
  authorizations: AuthorizationStats[];
}

interface DashboardData {
  clients: DashboardClient[];
  expiringSoon: DashboardClient[];
  totals: {
    activeClients: number;
    totalClients: number;
    expiringSoon: number;
    lowSupervision: number;
    lowParentTraining: number;
  };
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    amyFetch("/dashboard").then(setData);
  }, []);

  if (!data) {
    return <div className="text-stone-500">Loading...</div>;
  }

  const { clients, expiringSoon, totals } = data;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" subtitle="Your overview of clients, authorizations, and progress" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Clients"
          value={totals.activeClients}
          subtitle={`${totals.totalClients} total clients`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Expiring Soon"
          value={totals.expiringSoon}
          subtitle="Within 30 days"
          variant={totals.expiringSoon > 0 ? "warning" : "default"}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Low Supervision"
          value={totals.lowSupervision}
          subtitle="≤20% remaining"
          variant={totals.lowSupervision > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          title="Low Parent Training"
          value={totals.lowParentTraining}
          subtitle="≤20% remaining"
          variant={totals.lowParentTraining > 0 ? "warning" : "default"}
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      {expiringSoon.length > 0 && (
        <section className="card rounded-2xl p-6">
          <h2 className="section-title mb-4 flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            Upcoming Authorization Expirations
          </h2>
          <div className="space-y-2">
            {expiringSoon.map((client) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex items-center justify-between rounded-xl border border-amber-100/80 bg-gradient-to-r from-amber-50/80 to-orange-50/40 px-4 py-3 transition-all hover:border-amber-200 hover:shadow-soft"
              >
                <span className="font-medium text-stone-800">{client.name}</span>
                <span className="text-sm text-amber-700">
                  {client.daysUntilExpiration === 0
                    ? "Expires today"
                    : `${client.daysUntilExpiration} days left`}
                  {client.authorizationEnd &&
                    ` — ${format(new Date(client.authorizationEnd), "MMM d, yyyy")}`}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">Client Overview</h2>
          <Link to="/clients/new" className="btn-primary">
            Add Client
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="card rounded-2xl p-12 text-center">
            <div className="icon-badge mx-auto h-14 w-14">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-stone-900">No clients yet</h3>
            <p className="mt-2 text-stone-500">
              Add your first client to start tracking authorizations and sessions.
            </p>
            <Link to="/clients/new" className="btn-primary mt-6 inline-flex">
              Add Your First Client
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => (
              <Link key={client.id} to={`/clients/${client.id}`} className="card-hover block rounded-2xl p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-stone-900">{client.name}</h3>
                    {client.diagnosis && <p className="text-sm text-stone-500">{client.diagnosis}</p>}
                  </div>
                  {client.authorizationEnd && (
                    <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">
                      Auth ends {format(new Date(client.authorizationEnd), "MMM d, yyyy")}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {client.authorizations.map((auth) => (
                    <AuthorizationCard key={auth.serviceType} stats={auth} compact />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs text-stone-400">
                  {client.authorizations.map((auth) => (
                    <span key={auth.serviceType}>
                      {auth.serviceType === "SUPERVISION" && "Supervision"}
                      {auth.serviceType === "ASSESSMENT" && "Assessments"}
                      {auth.serviceType === "PARENT_TRAINING" && "Parent Training"}
                      {": "}
                      {(() => {
                        const b = formatAuthorizationBreakdown(auth.remainingMinutes);
                        return `${b.units} units (${b.hours} hrs) remaining (${auth.percentRemaining}%)`;
                      })()}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
