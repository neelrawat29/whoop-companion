import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  /** 24h "HH:MM" or null/empty */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Default period suggestion (used only as a hint when the user types a bare hour like "11") */
  defaultPeriod?: "AM" | "PM";
  /** Unused — kept for backwards compat with existing call sites */
  defaultHour?: number;
  className?: string;
  placeholder?: string;
}

function parse24(value: string | null | undefined): { h: number; m: number; period: "AM" | "PM" } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{1,2})/.exec(value);
  if (!m) return null;
  const h24 = Math.max(0, Math.min(23, parseInt(m[1])));
  const mm = Math.max(0, Math.min(59, parseInt(m[2])));
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h: h12, m: mm, period };
}

function to24(h12: number, mm: number, period: "AM" | "PM"): string {
  let h = h12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function formatDisplay(value: string | null | undefined): string {
  const p = parse24(value);
  if (!p) return "";
  return `${p.h}:${String(p.m).padStart(2, "0")} ${p.period}`;
}

/**
 * Parse loose user input into 24h HH:MM.
 * Accepts: "11", "11pm", "11 pm", "11:30", "11:30pm", "23:15", "7a", "7:05a", "1130pm", "2315"
 */
function parseLoose(raw: string, defaultPeriod: "AM" | "PM"): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  // Detect am/pm suffix
  let periodHint: "AM" | "PM" | null = null;
  let core = s;
  if (s.endsWith("am") || s.endsWith("a")) {
    periodHint = "AM";
    core = s.replace(/a m?$/i, "").replace(/am?$/, "");
  } else if (s.endsWith("pm") || s.endsWith("p")) {
    periodHint = "PM";
    core = s.replace(/p m?$/i, "").replace(/pm?$/, "");
  }

  let h: number;
  let m: number;

  if (core.includes(":")) {
    const parts = core.split(":");
    h = parseInt(parts[0]);
    m = parseInt(parts[1] ?? "0");
  } else {
    const digits = core.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 2) {
      h = parseInt(digits);
      m = 0;
    } else if (digits.length === 3) {
      h = parseInt(digits.slice(0, 1));
      m = parseInt(digits.slice(1));
    } else {
      h = parseInt(digits.slice(0, 2));
      m = parseInt(digits.slice(2, 4));
    }
  }

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (m < 0 || m > 59) return null;

  // 24h input (no am/pm hint, hour >= 13 or hour 0)
  if (periodHint == null && (h >= 13 || h === 0)) {
    if (h > 23) return null;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    return to24(h12, m, period);
  }

  if (h < 1 || h > 12) return null;
  const period = periodHint ?? defaultPeriod;
  return to24(h, m, period);
}

export function TimePicker({
  value,
  onChange,
  defaultPeriod = "PM",
  className,
  placeholder = "e.g. 11pm",
}: TimePickerProps) {
  const [text, setText] = React.useState<string>(formatDisplay(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setText(formatDisplay(value));
  }, [value, focused]);

  const parsed = parse24(value);
  const period = parsed?.period;

  function commit() {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange(null);
      setText("");
      return;
    }
    const next = parseLoose(trimmed, defaultPeriod);
    if (next) {
      onChange(next);
      setText(formatDisplay(next));
    } else {
      // Invalid — revert to last good value
      setText(formatDisplay(value));
    }
  }

  function setPeriod(p: "AM" | "PM") {
    if (!parsed) return;
    onChange(to24(parsed.h, parsed.m, p));
  }

  function clear() {
    onChange(null);
    setText("");
  }

  return (
    <div
      className={cn(
        "group inline-flex items-center gap-1 bg-muted/50 border border-border focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 rounded-2xl p-1.5 pl-3 transition-all w-full max-w-[14rem]",
        className,
      )}
    >
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setText(formatDisplay(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="flex-1 min-w-0 text-base font-semibold text-foreground bg-transparent focus:outline-none tabular-nums placeholder:text-muted-foreground/60 placeholder:font-normal"
        aria-label="Time"
      />
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setPeriod("AM")}
          disabled={!parsed}
          className={cn(
            "px-2 py-0.5 text-[9px] font-bold rounded-md uppercase transition-colors disabled:opacity-40",
            period === "AM"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          AM
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setPeriod("PM")}
          disabled={!parsed}
          className={cn(
            "px-2 py-0.5 text-[9px] font-bold rounded-md uppercase transition-colors disabled:opacity-40",
            period === "PM"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          PM
        </button>
      </div>
      {parsed && (
        <button
          type="button"
          tabIndex={-1}
          onClick={clear}
          className="shrink-0 ml-0.5 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent"
          aria-label="Clear time"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
