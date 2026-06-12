export type Recommendation = "push" | "moderate" | "rest";

export function recommend(recovery: number | null | undefined, push = 67, rest = 34): Recommendation | null {
  if (recovery == null) return null;
  if (recovery >= push) return "push";
  if (recovery < rest) return "rest";
  return "moderate";
}

export function recoveryColor(recovery: number | null | undefined, push = 67, rest = 34) {
  const r = recommend(recovery, push, rest);
  if (r === "push") return "text-[color:var(--recovery-high)]";
  if (r === "moderate") return "text-[color:var(--recovery-mid)]";
  if (r === "rest") return "text-[color:var(--recovery-low)]";
  return "text-muted-foreground";
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
