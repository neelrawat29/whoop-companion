import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  Home,
  LogOut,
  MessageCircle,
  Pill,
  Scale,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/", label: "Today", icon: Home },
  { to: "/log", label: "Log", icon: Calendar },
  { to: "/supplements", label: "Supplements", icon: Pill },
  { to: "/meals", label: "Meals", icon: UtensilsCrossed },
  { to: "/weight", label: "Weight", icon: Scale },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/chat", label: "Coach", icon: MessageCircle },
  { to: "/community", label: "Community", icon: Users },
  { to: "/import", label: "Import", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 border-r border-border/60 bg-card/70 backdrop-blur-xl flex-col z-30">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border/60">
          <div className="size-8 rounded-2xl bg-primary/10 grid place-items-center">
            <Activity className="size-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">Whoop Companion</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="font-medium">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start gap-3 text-muted-foreground rounded-2xl"
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header — soft frosted bar */}
      <header className="md:hidden sticky top-0 z-30 bg-background/75 backdrop-blur-xl pt-safe">
        <div className="px-5 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-2xl bg-primary/10 grid place-items-center shrink-0">
              <Activity className="size-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight truncate">Whoop Companion</span>
          </Link>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="size-9 rounded-2xl bg-card border border-border/60 grid place-items-center text-muted-foreground active:scale-95 transition-transform"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full min-w-0 md:pl-60">
        <div className="max-w-5xl mx-auto px-4 py-5 sm:px-6 sm:py-6 md:py-8 md:px-8 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </div>
      </main>

      {/* Floating iOS-style tab bar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 pointer-events-none">
        <div
          className="pointer-events-auto mx-3 mb-3 rounded-[28px] border border-white/60 bg-card/80 backdrop-blur-2xl shadow-[var(--shadow-float)]"
          style={{ marginBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none px-1.5 py-2">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = isActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`snap-start shrink-0 basis-1/5 min-w-[20%] flex flex-col items-center justify-center gap-1 py-1.5 rounded-2xl transition-colors ${
                    active ? "text-primary" : "text-muted-foreground/80"
                  }`}
                >
                  <div
                    className={`size-9 rounded-2xl grid place-items-center transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-4px_rgba(46,107,138,0.45)]"
                        : "bg-transparent"
                    }`}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight truncate max-w-full px-1">
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
