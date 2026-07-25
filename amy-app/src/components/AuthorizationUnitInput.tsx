"use client";

import { useState } from "react";
import { formatAuthorizationBreakdown, MINUTES_PER_AUTH_UNIT } from "@/lib/utils";

interface AuthorizationUnitInputProps {
  id: string;
  name: string;
  label: string;
  defaultValue?: number;
}

export function AuthorizationUnitInput({
  id,
  name,
  label,
  defaultValue = 0,
}: AuthorizationUnitInputProps) {
  const [units, setUnits] = useState(defaultValue);

  const breakdown =
    units > 0 ? formatAuthorizationBreakdown(units * MINUTES_PER_AUTH_UNIT) : null;

  return (
    <div className="rounded-xl border border-brand-100/60 bg-gradient-to-r from-brand-50/50 to-cream-100 p-4">
      <label className="label-field" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name={name}
          type="number"
          min="0"
          step="1"
          value={units || ""}
          onChange={(e) => setUnits(parseFloat(e.target.value) || 0)}
          className="input-field max-w-[140px]"
          placeholder="0"
        />
        <span className="text-sm text-stone-500">units</span>
      </div>
      <p className="mt-1 text-xs text-stone-400">
        1 unit = {MINUTES_PER_AUTH_UNIT} minutes
      </p>
      {breakdown && (
        <p className="mt-2 text-sm font-medium text-brand-700">
          = {breakdown.minutes.toLocaleString()} min · {breakdown.hours} hrs
        </p>
      )}
    </div>
  );
}
