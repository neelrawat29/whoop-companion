import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const estimateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { description: string }) => {
    if (!data?.description || typeof data.description !== "string") throw new Error("description required");
    if (data.description.length > 2000) throw new Error("Description too long");
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
            content:
              "Estimate nutrition for a described meal. Return ONLY JSON with keys: kcal (integer), protein_g (number), carbs_g (number), fat_g (number), confidence (0-1). No prose, no markdown. Best-effort estimate with typical serving sizes if quantities aren't specified.",
          },
          { role: "user", content: `Meal: ${data.description}` },
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
      const p = JSON.parse(cleaned);
      return {
        kcal: numOrNull(p.kcal),
        protein_g: numOrNull(p.protein_g),
        carbs_g: numOrNull(p.carbs_g),
        fat_g: numOrNull(p.fat_g),
        confidence: numOrNull(p.confidence),
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
