import { covePageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { ChatWindow } from "@/components/chat/ChatWindow";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => covePageHead("Coach Conversation", "Continue a private conversation with your Cove coach."),
  component: ChatThreadPage,
});

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  return <ChatWindow key={threadId} threadId={threadId} />;
}
