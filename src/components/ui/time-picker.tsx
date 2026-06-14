import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  /** 24h "HH:MM" or null/empty */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Default period when empty input gets first focus */
  defaultPeriod?: "AM" | "PM";
  /** Default hour (1–12) to seed when empty input is clicked */
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

export function TimePicker({
  value,
  onChange,
  defaultPeriod = "PM",
  defaultHour = 10,
  className,
  placeholder = "Set time",
}: TimePickerProps) {
  const parsed = parse24(value);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const minuteRef = React.useRef<HTMLInputElement>(null);

  const [hourText, setHourText] = React.useState<string>(parsed ? String(parsed.h).padStart(2, "0") : "");
  const [minuteText, setMinuteText] = React.useState<string>(parsed ? String(parsed.m).padStart(2, "0") : "");

  React.useEffect(() => {
    const p = parse24(value);
    setHourText(p ? String(p.h).padStart(2, "0") : "");
    setMinuteText(p ? String(p.m).padStart(2, "0") : "");
  }, [value]);

  const period: "AM" | "PM" = parsed?.period ?? defaultPeriod;

  function commit(nextHourText: string, nextMinuteText: string, nextPeriod: "AM" | "PM") {
    const h = parseInt(nextHourText);
    const m = parseInt(nextMinuteText);
    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      onChange(null);
      return;
    }
    const h12 = Math.max(1, Math.min(12, h));
    const mm = Math.max(0, Math.min(59, m));
    onChange(to24(h12, mm, nextPeriod));
  }

  function handleHourChange(raw: string) {
    // Accept paste like "10:30" or "22:30"
    const colon = raw.match(/^(\d{1,2}):(\d{1,2})\s*(am|pm)?$/i);
    if (colon) {
      const h24 = parseInt(colon[1]);
      const mm = parseInt(colon[2]);
      let nextPeriod: "AM" | "PM" = period;
      if (colon[3]) nextPeriod = colon[3].toUpperCase() as "AM" | "PM";
      else if (h24 >= 13) nextPeriod = "PM";
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      onChange(to24(h12, mm, nextPeriod));
      return;
    }
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setHourText(digits);
    if (digits.length === 2) {
      const n = parseInt(digits);
      if (n >= 1 && n <= 12) {
        commit(digits, minuteText || "00", period);
        minuteRef.current?.focus();
        minuteRef.current?.select();
      }
    }
  }

  function handleMinuteChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setMinuteText(digits);
    if (digits.length === 2) commit(hourText || String(defaultHour).padStart(2, "0"), digits, period);
  }

  function handleHourBlur() {
    if (!hourText) return;
    const n = Math.max(1, Math.min(12, parseInt(hourText) || defaultHour));
    const padded = String(n).padStart(2, "0");
    setHourText(padded);
    commit(padded, minuteText || "00", period);
  }

  function handleMinuteBlur() {
    if (!minuteText) {
      setMinuteText("00");
      if (hourText) commit(hourText, "00", period);
      return;
    }
    const n = Math.max(0, Math.min(59, parseInt(minuteText)));
    const padded = String(n).padStart(2, "0");
    setMinuteText(padded);
    commit(hourText || String(defaultHour).padStart(2, "0"), padded, period);
  }

  function setPeriod(p: "AM" | "PM") {
    if (!hourText) {
      const seeded = String(defaultHour).padStart(2, "0");
      setHourText(seeded);
      setMinuteText("00");
      commit(seeded, "00", p);
      return;
    }
    commit(hourText, minuteText || "00", p);
  }

  function activateEmpty() {
    const seededH = String(defaultHour).padStart(2, "0");
    setHourText(seededH);
    setMinuteText("00");
    commit(seededH, "00", defaultPeriod);
    requestAnimationFrame(() => {
      hourRef.current?.focus();
      hourRef.current?.select();
    });
  }

  if (!parsed && !hourText) {
    return (
      <button
        type="button"
        onClick={activateEmpty}
        className={cn(
          "group inline-flex items-center justify-between w-full bg-card border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 rounded-2xl px-4 py-2.5 transition-all cursor-pointer",
          className,
        )}
      >
        <span className="text-xs font-bold text-muted-foreground group-hover:text-primary uppercase tracking-tight">
          {placeholder}
        </span>
        <Plus className="size-3.5 text-muted-foreground group-hover:text-primary" strokeWidth={3} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "group inline-flex items-center bg-muted/50 border border-border focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 rounded-2xl p-1.5 transition-all w-fit",
        className,
      )}
    >
      <input
        ref={hourRef}
        type="text"
        inputMode="numeric"
        value={hourText}
        onChange={(e) => handleHourChange(e.target.value)}
        onBlur={handleHourBlur}
        onFocus={(e) => e.currentTarget.select()}
        className="w-10 text-center text-xl font-bold text-foreground bg-transparent focus:outline-none tabular-nums"
        aria-label="Hour"
      />
      <span className="text-muted-foreground/60 font-bold mb-0.5">:</span>
      <input
        ref={minuteRef}
        type="text"
        inputMode="numeric"
        value={minuteText}
        onChange={(e) => handleMinuteChange(e.target.value)}
        onBlur={handleMinuteBlur}
        onFocus={(e) => e.currentTarget.select()}
        className="w-10 text-center text-xl font-bold text-foreground bg-transparent focus:outline-none tabular-nums"
        aria-label="Minute"
      />
      <div className="ml-1.5 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => setPeriod("AM")}
          className={cn(
            "px-2 py-0.5 text-[9px] font-bold rounded-md uppercase cursor-pointer transition-colors",
            period === "AM"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => setPeriod("PM")}
          className={cn(
            "px-2 py-0.5 text-[9px] font-bold rounded-md uppercase cursor-pointer transition-colors",
            period === "PM"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          PM
        </button>
      </div>
    </div>
  );
}
