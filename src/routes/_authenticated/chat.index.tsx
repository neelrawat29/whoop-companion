import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const { data: latest } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("kind", "full")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.id) {
        navigate({ to: "/chat/$threadId", params: { threadId: latest.id }, replace: true });
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: created, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: u.user.id, kind: "full" })
        .select("id")
        .single();
      if (error || !created) return;
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: created.id }, replace: true });
    })();
  }, [navigate, qc]);

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center space-y-2">
        <MessageCircle className="size-8 mx-auto opacity-50" />
        <p className="text-sm">Opening chat…</p>
        <Button variant="outline" size="sm" onClick={() => started.current && (started.current = false)}>
          Retry
        </Button>
      </div>
    </div>
  );
}
