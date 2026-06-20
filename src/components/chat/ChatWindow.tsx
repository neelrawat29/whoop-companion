import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import coachAvatar from "@/assets/coach-avatar.png";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Why was my recovery low yesterday?",
  "How am I tracking toward my weight goal?",
  "What should I eat post-workout?",
  "How's my sleep been this week?",
];

export function ChatWindow({
  threadId,
  compact = false,
}: {
  threadId: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: initialMessages } = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, parts, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        role: row.role as UIMessage["role"],
        parts: row.parts as UIMessage["parts"],
      }));
    },
  });

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: { threadId },
      }),
    [threadId],
  );

  const cancelSavedRef = useRef(false);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages ?? [],
    transport,
    onError: (e) => toast.error(e.message),
    onFinish: async ({ message, isAbort }) => {
      if (isAbort && message && !cancelSavedRef.current) {
        cancelSavedRef.current = true;
        const parts = [...(message.parts ?? [])] as UIMessage["parts"];
        let lastTextIdx = -1;
        parts.forEach((p, i) => {
          if (p.type === "text") lastTextIdx = i;
        });
        if (lastTextIdx >= 0) {
          const t = parts[lastTextIdx] as { type: "text"; text: string };
          parts[lastTextIdx] = { type: "text", text: `${t.text}\n\n_Stopped._` } as never;
        } else {
          parts.push({ type: "text", text: "_Stopped._" } as never);
        }
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: u.user.id,
            role: "assistant",
            parts: parts as never,
          });
        }
      }
    },
  });

  useEffect(() => {
    if (status === "submitted" || status === "streaming") {
      cancelSavedRef.current = false;
    }
  }, [status]);

  // Focus the textarea on load + thread change + after stream done
  useEffect(() => {
    if (status === "ready") {
      inputRef.current?.focus();
    }
  }, [status, threadId]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
  }

  const isThinking = status === "submitted";
  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex flex-col h-full min-h-0", compact ? "" : "")}>
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {!hasMessages && (
            <ConversationEmptyState
              icon={<img src={coachAvatar} alt="" width={72} height={72} className="rounded-2xl" />}
              title="Hi, I'm Coach"
              description="Ask me anything about your recovery, sleep, training, nutrition, supplements, or weight journey."
            >
              <img src={coachAvatar} alt="" width={72} height={72} className="rounded-2xl" />
              <div className="space-y-1 max-w-sm">
                <h3 className="font-semibold">Hi, I'm Coach 👋</h3>
                <p className="text-muted-foreground text-sm">
                  Ask me anything about your recovery, sleep, training, nutrition, supplements, or weight journey. I'll use your logged data to give personal answers.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
                {SUGGESTIONS.slice(0, compact ? 2 : 4).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSend(s)}
                    className="text-left text-sm rounded-lg border border-border px-3 py-2 hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((m) => {
            const text = m.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("");
            return (
              <Message key={m.id} from={m.role}>
                {m.role === "assistant" && !compact && (
                  <img
                    src={coachAvatar}
                    alt=""
                    width={28}
                    height={28}
                    className="rounded-lg shrink-0"
                  />
                )}
                <MessageContent>
                  {m.role === "assistant" ? (
                    <Streamdown>{text}</Streamdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{text}</span>
                  )}
                </MessageContent>
              </Message>
            );
          })}

          {isThinking && (
            <Message from="assistant">
              {!compact && (
                <img src={coachAvatar} alt="" width={28} height={28} className="rounded-lg shrink-0" />
              )}
              <MessageContent>
                <Shimmer>Coach is thinking...</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="px-4 py-2 text-xs text-destructive border-t border-border">{error.message}</div>
      )}

      <div className="border-t border-border p-3 bg-background">
        <PromptInput
          onSubmit={(message) => {
            handleSend(message.text ?? "");
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            placeholder="Ask Coach about your health…"
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              size="icon-sm"
              className="rounded-full h-9 w-9"
              status={status}
              onStop={stop}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
