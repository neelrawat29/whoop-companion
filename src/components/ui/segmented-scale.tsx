import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedScaleOption {
  value: number;
  label: string;
}

export interface SegmentedScaleProps {
  options: SegmentedScaleOption[];
  value: number | null;
  onChange: (next: number | null) => void;
  className?: string;
  /** When true, tapping the selected value clears it. Default true. */
  allowClear?: boolean;
}

export function SegmentedScale({
  options,
  value,
  onChange,
  className,
  allowClear = true,
}: SegmentedScaleProps) {
  return (
    <div
      role="radiogroup"
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}
    >
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (on && allowClear) onChange(null);
              else onChange(opt.value);
            }}
            className={cn(
              "rounded-lg border px-1 py-2 text-center transition-colors select-none",
              on
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border hover:bg-accent text-foreground",
            )}
          >
            <div className={cn("text-base font-semibold tabular-nums leading-none", on ? "" : "text-muted-foreground")}>
              {opt.value}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wide mt-1 leading-none">
              {opt.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
