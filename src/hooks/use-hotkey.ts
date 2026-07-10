import { useEffect } from "react";

type Handler = (e: KeyboardEvent) => void;

/**
 * Register a keyboard shortcut. Combos are strings like "mod+k", "shift+n", or "g m".
 * "mod" = Cmd on macOS, Ctrl elsewhere. Sequences are separated by spaces.
 */
export function useHotkey(combo: string, handler: Handler, deps: unknown[] = []) {
  useEffect(() => {
    const parts = combo.toLowerCase().split(" ").filter(Boolean);
    let stepIndex = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function matches(step: string, e: KeyboardEvent) {
      const keys = step.split("+");
      const key = keys.pop() ?? "";
      const needMod = keys.includes("mod");
      const needShift = keys.includes("shift");
      const needAlt = keys.includes("alt");
      const modOk = needMod ? e.metaKey || e.ctrlKey : !e.metaKey && !e.ctrlKey;
      const shiftOk = needShift ? e.shiftKey : !e.shiftKey;
      const altOk = needAlt ? e.altKey : !e.altKey;
      return modOk && shiftOk && altOk && e.key.toLowerCase() === key;
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        // Allow mod+ combos even in inputs; block plain-key sequences.
        if (!(e.metaKey || e.ctrlKey)) return;
      }
      const step = parts[stepIndex];
      if (!step) return;
      if (matches(step, e)) {
        e.preventDefault();
        stepIndex++;
        if (stepIndex >= parts.length) {
          handler(e);
          stepIndex = 0;
          if (timer) clearTimeout(timer);
          return;
        }
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          stepIndex = 0;
        }, 1000);
      } else if (stepIndex > 0) {
        stepIndex = 0;
        if (timer) clearTimeout(timer);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
