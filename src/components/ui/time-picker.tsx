import * as React from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface TimePickerProps {
  /** 24h "HH:MM" or null/empty */
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  /** Used as initial wheel position when no value is set. */
  defaultPeriod?: "AM" | "PM";
  /** 1–12 hour to seed the wheel when no value is set. */
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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
const PERIODS = ["AM", "PM"] as const;

const ITEM_HEIGHT = 36; // px
const VISIBLE = 5; // odd number — center is selected
const PADDING = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  format,
  ariaLabel,
}: {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const lastEmitted = React.useRef<T>(value);
  const scrollTimeout = React.useRef<number | null>(null);

  // Scroll to value when it changes from outside
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(value);
    if (idx < 0) return;
    if (lastEmitted.current === value) {
      const target = idx * ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - target) > 1) {
        el.scrollTo({ top: target, behavior: "auto" });
      }
    }
  }, [value, items]);

  // Initial position
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.indexOf(value));
    el.scrollTop = idx * ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped];
      // Snap precisely
      const target = clamped * ITEM_HEIGHT;
      if (Math.abs(el.scrollTop - target) > 0.5) {
        el.scrollTo({ top: target, behavior: "smooth" });
      }
      if (next !== lastEmitted.current) {
        lastEmitted.current = next;
        onChange(next);
      }
    }, 90);
  }

  function nudge(delta: number) {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(items.length - 1, items.indexOf(value) + delta));
    el.scrollTo({ top: idx * ITEM_HEIGHT, behavior: "smooth" });
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudge(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          nudge(-1);
        }
      }}
      tabIndex={0}
      role="listbox"
      aria-label={ariaLabel}
      className="relative overflow-y-scroll snap-y snap-mandatory outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md [&::-webkit-scrollbar]:hidden"
      style={{
        height: VISIBLE * ITEM_HEIGHT,
        scrollbarWidth: "none",
      }}
    >
      <div style={{ height: PADDING }} />
      {items.map((it) => {
        const selected = it === value;
        return (
          <div
            key={String(it)}
            className={cn(
              "flex items-center justify-center snap-center tabular-nums transition-all",
              selected ? "text-foreground font-semibold text-lg" : "text-muted-foreground/60 text-base",
            )}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              el.scrollTo({ top: items.indexOf(it) * ITEM_HEIGHT, behavior: "smooth" });
            }}
          >
            {format ? format(it) : String(it)}
          </div>
        );
      })}
      <div style={{ height: PADDING }} />
    </div>
  );
}

export function TimePicker({
  value,
  onChange,
  defaultPeriod = "PM",
  defaultHour = 9,
  className,
  placeholder = "Set time",
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parse24(value);

  // Draft state inside the popover. Reset each time it opens.
  const [draftH, setDraftH] = React.useState<number>(parsed?.h ?? defaultHour);
  const [draftM, setDraftM] = React.useState<number>(parsed?.m ?? 0);
  const [draftP, setDraftP] = React.useState<"AM" | "PM">(parsed?.period ?? defaultPeriod);

  React.useEffect(() => {
    if (open) {
      const p = parse24(value);
      setDraftH(p?.h ?? defaultHour);
      setDraftM(p?.m ?? 0);
      setDraftP(p?.period ?? defaultPeriod);
    }
  }, [open, value, defaultHour, defaultPeriod]);

  function commit() {
    onChange(to24(draftH, draftM, draftP));
    setOpen(false);
  }
  function setNow() {
    const d = new Date();
    const h24 = d.getHours();
    const mm = d.getMinutes();
    setDraftP(h24 >= 12 ? "PM" : "AM");
    setDraftH(h24 % 12 === 0 ? 12 : h24 % 12);
    setDraftM(mm);
  }
  function clear() {
    onChange(null);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 w-full max-w-[14rem] rounded-2xl border bg-muted/50 border-border hover:border-primary/40 transition-colors px-3 py-2 text-left",
            className,
          )}
        >
          <Clock className="size-4 text-muted-foreground shrink-0" />
          <span
            className={cn(
              "flex-1 text-base font-semibold tabular-nums truncate",
              parsed ? "text-foreground" : "text-muted-foreground/70 font-normal",
            )}
          >
            {parsed ? formatDisplay(value) : placeholder}
          </span>
          {parsed && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-accent"
              aria-label="Clear time"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[18rem] p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <Button type="button" variant="ghost" size="sm" onClick={setNow}>
            Now
          </Button>
          <div className="text-sm font-semibold tabular-nums">
            {draftH}:{String(draftM).padStart(2, "0")} {draftP}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {/* Center highlight band */}
          <div
            className="pointer-events-none absolute inset-x-0 rounded-md bg-primary/10 border-y border-primary/30"
            style={{ top: PADDING, height: ITEM_HEIGHT }}
          />
          <Wheel items={HOURS} value={draftH} onChange={setDraftH} ariaLabel="Hour" />
          <Wheel
            items={MINUTES}
            value={draftM}
            onChange={setDraftM}
            format={(v) => String(v).padStart(2, "0")}
            ariaLabel="Minute"
          />
          <Wheel items={PERIODS} value={draftP} onChange={setDraftP} ariaLabel="AM or PM" />
        </div>
        <div className="flex items-center justify-between gap-2 mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={commit}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
