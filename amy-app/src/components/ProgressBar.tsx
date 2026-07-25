"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  percent: number;
  color?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ProgressBar({
  percent,
  color = "bg-brand-400",
  size = "md",
  showLabel = true,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="w-full">
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-brand-50",
          size === "sm" ? "h-2" : "h-3"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
            color
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-1.5 text-xs font-medium text-stone-400">{clamped}% used</p>
      )}
    </div>
  );
}
