import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Activity, BarChart3, Calendar, Download, Home, LogOut, MessageCircle, Pill, Scale, Settings, Users, UtensilsCrossed } from "lucide-react";
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
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 border-r border-border bg-card flex-col z-30">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <Activity className="size-5 text-primary" />
          <span className="font-semibold">Whoop Companion</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-accent text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r" />}
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-3 text-muted-foreground">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Activity className="size-5 text-primary" />
            <span>Whoop Companion</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 w-full min-w-0 md:pl-60">
        <div className="max-w-5xl mx-auto px-4 py-5 pb-24 sm:px-6 sm:py-6 md:py-8 md:px-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-card z-30 pb-[env(safe-area-inset-bottom)]">
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className={`snap-start shrink-0 basis-1/5 min-w-[20%] flex flex-col items-center justify-center gap-1 py-2 text-[11px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
