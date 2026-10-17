import { createFileRoute } from "@tanstack/react-router";
import { verifyWhoopSignature, whoopWebhookSchema } from "@/lib/whoop-webhook";

export const Route = createFileRoute("/api/public/whoop/webhook")({
  server: { handlers: {
    POST: async ({ request }) => {
      const secret = process.env["WHOOP_CLIENT_SECRET"];
      if (!secret) return new Response("Unavailable", { status: 503 });
      if (Number(request.headers.get("content-length")) > 16_384) return new Response("Too large", { status: 413 });
      const reader = request.body?.getReader();
      if (!reader) return new Response("Missing body", { status: 400 });
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 16_384) { await reader.cancel(); return new Response("Too large", { status: 413 }); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const raw = new TextDecoder().decode(bytes);
      if (!await verifyWhoopSignature(raw, request.headers.get("x-whoop-signature-timestamp"), request.headers.get("x-whoop-signature"), secret)) return new Response("Unauthorized", { status: 401 });
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
      const parsed = whoopWebhookSchema.safeParse(payload);
      if (!parsed.success) return new Response("Invalid event", { status: 400 });
      try {
        const { receiveWhoopWebhook } = await import("@/lib/whoop-webhook.server");
        // Only acknowledge after durable processing; WHOOP retries non-2xx,
        // and the unchanged hourly job retries any persisted unfinished events.
        await receiveWhoopWebhook(parsed.data);
        return new Response(null, { status: 204 });
      } catch {
        console.error("WHOOP webhook processing failed");
        return new Response("Please retry", { status: 503 });
      }
    },
  } },
});