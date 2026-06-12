import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const extractFromScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { imageBase64: string }) => {
    if (!data?.imageBase64 || typeof data.imageBase64 !== "string") throw new Error("imageBase64 required");
    if (data.imageBase64.length > 8_000_000) throw new Error("Image too large");
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Extract Whoop metrics from a screenshot. Return ONLY JSON with these keys (numbers or null): recovery (0-100), hrv (ms), rhr (bpm), sleep_score (0-100), sleep_hours. No prose, no markdown.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the Whoop metrics from this screenshot." },
              { type: "image_url", image_url: { url: data.imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Rate limit hit — try again in a minute");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (!res.ok) throw new Error(`AI error ${res.status}`);

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        recovery: numOrNull(parsed.recovery),
        hrv: numOrNull(parsed.hrv),
        rhr: numOrNull(parsed.rhr),
        sleep_score: numOrNull(parsed.sleep_score),
        sleep_hours: numOrNull(parsed.sleep_hours),
      };
    } catch {
      throw new Error("Could not parse AI response");
    }
  });

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}
