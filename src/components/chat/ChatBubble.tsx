import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, ArrowUpRight } from "lucide-react";
import { ChatWindow } from "./ChatWindow";
import coachAvatar from "@/assets/coach-avatar.png";

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide on chat routes (full UI already there) and auth pages
  const hidden = pathname.startsWith("/chat") || pathname.startsWith("/auth");

  const { data: quickThreadId } = useQuery({
    queryKey: ["quick-chat-thread"],
    enabled: open,
    queryFn: async (): Promise<string> => {
      const { data: existing } = await supabase
        .from("chat_threads")
        .select("id")
        .eq("kind", "quick")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) return existing.id;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: created, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: u.user.id, kind: "quick", title: "Quick chat" })
        .select("id")
        .single();
      if (error) throw error;
      return created.id;
    },
  });

  const promoteToFull = useMutation({
    mutationFn: async () => {
      if (!quickThreadId) throw new Error("No thread");
      // Promote: change kind so it shows in the full chat list
      const { error } = await supabase
        .from("chat_threads")
        .update({ kind: "full" })
        .eq("id", quickThreadId);
      if (error) throw error;
      return quickThreadId;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      qc.invalidateQueries({ queryKey: ["quick-chat-thread"] });
      setOpen(false);
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    },
  });

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Coach chat"
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 size-14 rounded-full shadow-lg bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
      >
        <MessageCircle className="size-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col gap-0 [&>button]:hidden"
        >
          <SheetHeader className="px-4 py-3 border-b border-border flex-row items-center gap-3 space-y-0">
            <img src={coachAvatar} alt="" width={32} height={32} className="rounded-lg" />
            <SheetTitle className="flex-1 text-base">Coach</SheetTitle>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => promoteToFull.mutate()}
              disabled={!quickThreadId || promoteToFull.isPending}
              title="Open in full view"
            >
              <ArrowUpRight className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} title="Close">
              <X className="size-4" />
            </Button>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            {quickThreadId ? (
              <ChatWindow key={quickThreadId} threadId={quickThreadId} compact />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
