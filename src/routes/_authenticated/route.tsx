import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChatBubble } from "@/components/chat/ChatBubble";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.session.user.id)
      .maybeSingle();
    const done = profile?.onboarding_completed ?? false;
    const onSetup = location.pathname === "/onboarding";
    if (!done && !onSetup) throw redirect({ to: "/onboarding" });
    if (done && onSetup) throw redirect({ to: "/" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Setup is a focused, full-screen flow without app navigation.
  if (pathname === "/onboarding") return <Outlet />;
  return (
    <AppShell>
      <Outlet />
      <ChatBubble />
    </AppShell>
  );
}
