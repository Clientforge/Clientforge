import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatClientName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export const MINUTES_PER_AUTH_UNIT = 15;

export function unitsToMinutes(units: number): number {
  return Math.round(units * MINUTES_PER_AUTH_UNIT);
}

export function minutesToUnits(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_AUTH_UNIT) * 100) / 100;
}

export function parseDuration(value: number, unit: "HOURS" | "MINUTES" | "UNITS"): number {
  if (unit === "UNITS") return unitsToMinutes(value);
  return unit === "HOURS" ? hoursToMinutes(value) : value;
}

export function formatDuration(minutes: number, display: "HOURS" | "MINUTES" | "UNITS"): string {
  if (display === "UNITS") {
    const units = minutesToUnits(minutes);
    return `${units} unit${units === 1 ? "" : "s"}`;
  }
  if (display === "MINUTES") {
    return `${minutes} min`;
  }
  const hours = minutesToHours(minutes);
  return `${hours} hr${hours === 1 ? "" : "s"}`;
}

/** Full breakdown: units, minutes, and hours for authorization display */
export function formatAuthorizationBreakdown(minutes: number): {
  units: number;
  minutes: number;
  hours: number;
  label: string;
  shortLabel: string;
} {
  const units = minutesToUnits(minutes);
  const hours = minutesToHours(minutes);
  const label = `${units} unit${units === 1 ? "" : "s"} · ${minutes.toLocaleString()} min · ${hours} hr${hours === 1 ? "" : "s"}`;
  const shortLabel = `${units} units (${hours} hrs)`;
  return { units, minutes, hours, label, shortLabel };
}

export function formatPercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

export function getAge(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export const SERVICE_LABELS: Record<string, string> = {
  SUPERVISION: "Supervision",
  ASSESSMENT: "Assessments",
  PARENT_TRAINING: "Parent Training",
};

export const SERVICE_COLORS: Record<string, string> = {
  SUPERVISION: "from-mauve-400 to-mauve-500",
  ASSESSMENT: "from-blush-400 to-brand-400",
  PARENT_TRAINING: "from-emerald-300 to-teal-400",
};

export const SERVICE_DOT_COLORS: Record<string, string> = {
  SUPERVISION: "bg-mauve-400",
  ASSESSMENT: "bg-blush-400",
  PARENT_TRAINING: "bg-emerald-400",
};
