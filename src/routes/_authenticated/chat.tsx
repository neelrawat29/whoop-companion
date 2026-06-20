import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

type ThreadRow = { id: string; title: string | null; updated_at: string; kind: string };

function ChatLayout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const { data: threads } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: async (): Promise<ThreadRow[]> => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("id, title, updated_at, kind")
        .eq("kind", "full")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createThread = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: u.user.id, kind: "full" })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_threads").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (deletedId === activeId) {
        navigate({ to: "/chat" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="-mx-4 md:-mx-8 -my-6 md:-my-8 -mb-24 md:mb-0 h-[calc(100vh-3.5rem)] md:h-screen flex">
      {/* Threads sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <span className="font-semibold text-sm flex-1">Chats</span>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => createThread.mutate()}
            disabled={createThread.isPending}
            title="New chat"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {(threads ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">
              No chats yet. Click + to start one.
            </p>
          )}
          {(threads ?? []).map((t) => {
            const active = t.id === activeId;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md transition-colors",
                  active ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 min-w-0 px-2.5 py-2 text-sm truncate"
                >
                  {t.title || "New chat"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete this chat?")) deleteThread.mutate(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded text-muted-foreground hover:text-destructive transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
