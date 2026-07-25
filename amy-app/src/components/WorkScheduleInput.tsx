"use client";

import { useState } from "react";
import {
  WEEKDAYS,
  WorkDay,
  DaySchedule,
  computeHoursFromTimeRange,
  computeMonthlyWorkHours,
  computeRequiredSupervisionHours,
  computeWeeklyWorkHours,
  formatDayScheduleEntry,
  serializeWorkSchedule,
} from "@/lib/rbt-calculations";

export interface WorkScheduleValues {
  workSchedule: DaySchedule[];
  supervisionPercentage: number;
}

interface WorkScheduleInputProps {
  defaultValues?: Partial<WorkScheduleValues>;
}

const DEFAULT_WEEKDAY: WorkDay[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

function buildInitialRows(defaultSchedule?: DaySchedule[]) {
  const scheduleMap = new Map(defaultSchedule?.map((e) => [e.day, e]));

  return WEEKDAYS.map(({ key }) => {
    const existing = scheduleMap.get(key);
    const enabled = existing !== undefined || (!defaultSchedule && DEFAULT_WEEKDAY.includes(key));
    return {
      day: key,
      enabled,
      startTime: existing?.startTime ?? "09:00",
      endTime: existing?.endTime ?? "17:00",
    };
  });
}

export function WorkScheduleInput({ defaultValues }: WorkScheduleInputProps) {
  const [rows, setRows] = useState(() => buildInitialRows(defaultValues?.workSchedule));
  const [supervisionPercentage, setSupervisionPercentage] = useState(
    defaultValues?.supervisionPercentage ?? 5
  );

  function updateRow(day: WorkDay, updates: Partial<(typeof rows)[0]>) {
    setRows((prev) =>
      prev.map((row) => (row.day === day ? { ...row, ...updates } : row))
    );
  }

  const activeSchedule: DaySchedule[] = rows
    .filter((row) => row.enabled)
    .map(({ day, startTime, endTime }) => ({ day, startTime, endTime }));

  const weeklyWorkHours = computeWeeklyWorkHours(activeSchedule);
  const monthlyWorkHours = computeMonthlyWorkHours(activeSchedule);
  const requiredHours = computeRequiredSupervisionHours(
    monthlyWorkHours,
    supervisionPercentage
  );

  return (
    <div className="space-y-5">
      <input type="hidden" name="workSchedule" value={serializeWorkSchedule(activeSchedule)} />

      <div>
        <p className="label-field">Weekly Schedule</p>
        <p className="mb-3 text-xs text-stone-400">
          Select work days and set start/end times for each. Hours are calculated automatically
          from the time range.
        </p>
        <div className="space-y-2">
          {rows.map((row) => {
            const hours = row.enabled
              ? computeHoursFromTimeRange(row.startTime, row.endTime)
              : 0;
            const dayLabel = WEEKDAYS.find((d) => d.key === row.day)!;

            return (
              <div
                key={row.day}
                className={`rounded-xl border p-3.5 transition-all ${
                  row.enabled
                    ? "border-brand-200/80 bg-gradient-to-r from-brand-50/60 to-blush-50/40"
                    : "border-stone-200/60 bg-stone-50/50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-w-[100px] items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) => updateRow(row.day, { enabled: e.target.checked })}
                      className="rounded border-stone-300 text-brand-600 focus:ring-brand-200"
                    />
                    {dayLabel.full}
                  </label>

                  {row.enabled && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={row.startTime}
                          onChange={(e) => updateRow(row.day, { startTime: e.target.value })}
                          className="input-field w-auto py-1.5 text-sm"
                        />
                        <span className="text-stone-300">–</span>
                        <input
                          type="time"
                          value={row.endTime}
                          onChange={(e) => updateRow(row.day, { endTime: e.target.value })}
                          className="input-field w-auto py-1.5 text-sm"
                        />
                      </div>
                      <span className="ml-auto text-sm font-semibold text-brand-700">
                        {hours} hr{hours === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label-field" htmlFor="supervisionPercentage">
          Required Supervision Percentage
        </label>
        <div className="flex items-center gap-2">
          <input
            id="supervisionPercentage"
            name="supervisionPercentage"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={supervisionPercentage}
            onChange={(e) => setSupervisionPercentage(parseFloat(e.target.value) || 0)}
            className="input-field max-w-[120px]"
          />
          <span className="text-sm text-stone-500">%</span>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          Adjust based on requirements or situation (e.g., 5%, 10%, 12%)
        </p>
      </div>

      <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 to-mauve-50/40 p-5">
        <p className="font-display text-sm font-semibold text-brand-800">Calculated Supervision</p>
        {activeSchedule.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs text-brand-700">
            {activeSchedule.map((entry) => (
              <li key={entry.day}>{formatDayScheduleEntry(entry)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-brand-700">No work days selected</p>
        )}
        <div className="mt-3 space-y-1 text-sm text-brand-800">
          <p>
            Weekly work hours: <strong>{weeklyWorkHours} hrs</strong>
          </p>
          <p>
            Estimated monthly work hours:{" "}
            <strong>
              {weeklyWorkHours} × {4.33} = {monthlyWorkHours} hrs
            </strong>
          </p>
          <p>
            Required supervision ({supervisionPercentage}%):{" "}
            <strong>
              {monthlyWorkHours} × {supervisionPercentage}% = {requiredHours} hrs
            </strong>
          </p>
        </div>
      </div>
    </div>
  );
}
