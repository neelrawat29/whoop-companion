import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function timeAgo(d: Date | null): string {
  if (!d) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

export function useTick(intervalMs = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

export const flashRingClasses =
  "ring-2 ring-green-500/60 shadow-[0_0_0_4px_rgba(34,197,94,0.15)]";

export function useSaveFlash(ms = 800) {
  const [flash, setFlash] = useState(false);
  const trigger = useCallback(() => {
    setFlash(true);
    const id = setTimeout(() => setFlash(false), ms);
    return () => clearTimeout(id);
  }, [ms]);
  return { flash, trigger };
}

export function SaveBar({
  isDirty,
  isPending,
  isSaved,
  lastSavedAt,
  dirtyLabel,
  onClick,
}: {
  isDirty: boolean;
  isPending: boolean;
  isSaved: boolean;
  lastSavedAt: Date | null;
  dirtyLabel: string;
  onClick?: () => void;
}) {
  useTick();
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        type={onClick ? "button" : "submit"}
        onClick={onClick}
        disabled={isPending || !isDirty}
        variant={!isDirty && isSaved ? "secondary" : "default"}
      >
        {isPending ? (
          "Saving..."
        ) : !isDirty && isSaved ? (
          <><Check className="size-4" /> Saved</>
        ) : (
          dirtyLabel
        )}
      </Button>
      <span
        className={cn(
          "text-xs",
          isDirty ? "text-amber-500" : "text-muted-foreground",
        )}
      >
        {isDirty
          ? "Unsaved changes"
          : lastSavedAt
            ? `All changes saved · ${timeAgo(lastSavedAt)}`
            : ""}
      </span>
    </div>
  );
}
