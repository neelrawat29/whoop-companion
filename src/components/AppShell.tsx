import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Activity, BarChart3, Calendar, Download, Home, LogOut, Pill, Settings, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/", label: "Today", icon: Home, mobile: true },
  { to: "/log", label: "Log", icon: Calendar, mobile: true },
  { to: "/supplements", label: "Supplements", icon: Pill, mobile: false },
  { to: "/meals", label: "Meals", icon: UtensilsCrossed, mobile: true },
  { to: "/insights", label: "Insights", icon: BarChart3, mobile: true },
  { to: "/import", label: "Import", icon: Download, mobile: false },
  { to: "/settings", label: "Settings", icon: Settings, mobile: true },
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Activity className="size-5 text-primary" />
            <span>Whoop Companion</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-border bg-card md:static md:bg-transparent md:border-t-0 md:border-b md:order-first">
        <div className="max-w-5xl mx-auto grid grid-cols-5 md:flex md:gap-1 md:justify-center md:py-2">
          {nav.map(({ to, label, icon: Icon, mobile }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`${mobile ? "flex" : "hidden md:flex"} flex-col md:flex-row md:gap-2 items-center justify-center gap-1 py-2 md:px-4 md:py-1.5 text-xs md:text-sm md:rounded-md transition-colors ${
                  active ? "text-primary md:bg-accent" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5 md:size-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
