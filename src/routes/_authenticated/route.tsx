import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { registerPushNotifications } from "@/lib/push";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();

  useEffect(() => {
    if (user?.id) {
      void registerPushNotifications(user.id);
    }
  }, [user?.id]);

  return (
    <AppShell>
      <Outlet />
      <ChatBubble />
    </AppShell>
  );
}

