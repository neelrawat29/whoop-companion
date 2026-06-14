import * as React from "react";
import { format, parseISO, addDays, isToday, isYesterday, isAfter, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  disableFuture?: boolean;
  allowFuture?: boolean;
  className?: string;
  /** Show calendar with year/decade navigation (useful for DOB) */
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  startMonth?: Date;
  endMonth?: Date;
  showYear?: boolean;
}

export function DatePicker({
  value,
  onChange,
  disableFuture = true,
  allowFuture = false,
  className,
  captionLayout,
  startMonth,
  endMonth,
  showYear = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const date = value ? parseISO(value) : new Date();
  const today = startOfDay(new Date());

  const futureBlocked = disableFuture && !allowFuture;
  const atOrAfterToday = !isAfter(today, date);

  const label = showYear
    ? format(date, "MMM d, yyyy")
    : isToday(date)
    ? "Today"
    : isYesterday(date)
    ? "Yesterday"
    : format(date, "EEE, MMM d");

  function step(days: number) {
    const next = addDays(date, days);
    if (futureBlocked && isAfter(startOfDay(next), today)) return;
    onChange(toISO(next));
  }

  return (
    <div className={cn("inline-flex items-center bg-card border border-border rounded-full shadow-sm p-1 pl-4", className)}>
      <span className="text-sm font-semibold text-foreground mr-3 tabular-nums whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous day"
          className="p-1.5 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-primary cursor-pointer"
        >
          <ChevronLeft className="size-4" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={futureBlocked && atOrAfterToday}
          aria-label="Next day"
          className="p-1.5 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        >
          <ChevronRight className="size-4" strokeWidth={2.5} />
        </button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open calendar"
              className="ml-0.5 p-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <CalendarIcon className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="end">
            {disableFuture && (
              <div className="flex gap-1.5 mb-3">
                {[
                  { label: "Today", days: 0 },
                  { label: "Yesterday", days: -1 },
                  { label: "7d ago", days: -7 },
                ].map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      onChange(toISO(addDays(today, q.days)));
                      setOpen(false);
                    }}
                    className="flex-1 px-2 py-1 text-xs font-medium rounded-md bg-muted hover:bg-accent text-foreground transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                if (!d) return;
                onChange(toISO(d));
                setOpen(false);
              }}
              disabled={futureBlocked ? { after: today } : undefined}
              captionLayout={captionLayout}
              startMonth={startMonth}
              endMonth={endMonth}
              initialFocus
              className={cn("pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
