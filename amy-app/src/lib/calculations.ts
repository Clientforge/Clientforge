import { formatPercent, minutesToUnits } from "./utils";

export type ServiceType = "SUPERVISION" | "ASSESSMENT" | "PARENT_TRAINING";

export interface AuthorizationStats {
  serviceType: ServiceType;
  authorizedMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
  authorizedUnits: number;
  usedUnits: number;
  remainingUnits: number;
  percentUsed: number;
  percentRemaining: number;
  unitDisplay: "UNITS" | "HOURS" | "MINUTES";
}

export function computeAuthorizationStats(
  authorizedMinutes: number,
  usedMinutes: number,
  serviceType: ServiceType,
  unitDisplay: "UNITS" | "HOURS" | "MINUTES" = "UNITS"
): AuthorizationStats {
  const remainingMinutes = Math.max(0, authorizedMinutes - usedMinutes);
  const percentUsed = formatPercent(usedMinutes, authorizedMinutes);
  const percentRemaining = authorizedMinutes > 0 ? Math.round((100 - percentUsed) * 10) / 10 : 0;

  return {
    serviceType,
    authorizedMinutes,
    usedMinutes,
    remainingMinutes,
    authorizedUnits: minutesToUnits(authorizedMinutes),
    usedUnits: minutesToUnits(usedMinutes),
    remainingUnits: minutesToUnits(remainingMinutes),
    percentUsed,
    percentRemaining,
    unitDisplay,
  };
}

export function sumSessionMinutes(
  sessions: { durationMinutes: number; serviceType: ServiceType }[],
  serviceType: ServiceType
): number {
  return sessions
    .filter((s) => s.serviceType === serviceType)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
}

export interface ClientOverview {
  id: string;
  name: string;
  isActive: boolean;
  authorizationEnd: Date | null;
  authorizations: AuthorizationStats[];
  daysUntilExpiration: number | null;
}

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
