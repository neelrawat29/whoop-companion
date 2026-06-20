import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ChatRequestBody = {
  threadId?: string;
  messages?: UIMessage[];
};

const SYSTEM_PROMPT = `You are "Coach", a friendly, evidence-based personal health and fitness coach inside the user's wellness tracking app.

STRICT SCOPE — you ONLY answer questions related to:
- Sleep, recovery, HRV, strain, training, exercise, mobility
- Nutrition, meals, calories, macros, hydration, supplements
- Weight management, body composition
- Habits, stress, mood, energy, lifestyle that affect health
- Interpreting the user's own logged data shown below

If the user asks ANYTHING outside this scope (coding help, news, trivia, general chit-chat, politics, math homework, creative writing, etc.), refuse in ONE short friendly sentence and steer them back. Example: "I'm your health & fitness coach — let's stick to that. What about your training, sleep, or nutrition can I help with?"

STYLE:
- Be concise, warm, and specific. Use the user's actual data when relevant.
- Use short paragraphs and bullet points. Use markdown.
- Cite specific numbers from their data when you reference it ("your avg sleep last week was 6.4h").
- If you don't have enough data for a personal answer, say so and offer general best practice.
- Never invent data. If a metric is missing in the context block, say it's not logged.
- Do NOT give medical diagnoses; suggest they consult a clinician for symptoms or medication questions.`;

function safeNum(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return null;
  return Number(n.toFixed(digits));
}

async function buildUserContext(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
): Promise<string> {
  const today = new Date();
  const fourteenAgo = new Date(today);
  fourteenAgo.setDate(today.getDate() - 14);
  const since = fourteenAgo.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [profileRes, entriesRes, habitsRes, weightRes, mealsRes, suppsRes] = await Promise.all([
    supabase.from("profiles").select("display_name, weight_goal_kg, weight_goal_date, weight_unit").eq("id", userId).maybeSingle(),
    supabase.from("daily_entries").select("entry_date, recovery, hrv, sleep_hours, sleep_score").gte("entry_date", since).order("entry_date", { ascending: false }).limit(14),
    supabase.from("habits_log").select("entry_date, mood, energy, strain, drinks, hydration, supplements, note, work_location, bedtime, last_caffeine_time").gte("entry_date", since).order("entry_date", { ascending: false }).limit(14),
    supabase.from("weight_entries" as never).select("entry_date, weight_kg").order("entry_date", { ascending: false }).limit(8),
    supabase.from("meals").select("slot, description, kcal, protein_g, carbs_g, fat_g").eq("entry_date", todayStr),
    supabase.from("user_supplements").select("name, brand, serving_size").order("name").limit(30),
  ]);

  const profile = profileRes.data;
  const entries = (entriesRes.data ?? []) as Array<{ entry_date: string; recovery: number | null; hrv: number | null; sleep_hours: number | null; sleep_score: number | null }>;
  const habits = (habitsRes.data ?? []) as Array<{ entry_date: string; mood: number | null; energy: number | null; strain: number | null; drinks: number | null; hydration: number | null; supplements: string[] | null; note: string | null; work_location: string | null; bedtime: string | null; last_caffeine_time: string | null }>;
  const weights = (weightRes.data ?? []) as Array<{ entry_date: string; weight_kg: number }>;
  const meals = mealsRes.data ?? [];
  const supps = suppsRes.data ?? [];

  // Aggregates
  const avg = (arr: Array<number | null | undefined>) => {
    const nums = arr.filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };
  const last7 = entries.slice(0, 7);
  const aggregates = {
    avg_recovery_7d: safeNum(avg(last7.map((e) => e.recovery)), 0),
    avg_hrv_7d: safeNum(avg(last7.map((e) => e.hrv)), 1),
    avg_sleep_hours_7d: safeNum(avg(last7.map((e) => e.sleep_hours)), 2),
    avg_sleep_score_7d: safeNum(avg(last7.map((e) => e.sleep_score)), 0),
    avg_mood_7d: safeNum(avg(habits.slice(0, 7).map((h) => h.mood)), 1),
    avg_energy_7d: safeNum(avg(habits.slice(0, 7).map((h) => h.energy)), 1),
    avg_strain_7d: safeNum(avg(habits.slice(0, 7).map((h) => h.strain)), 1),
    drinks_last_7d: habits.slice(0, 7).reduce((sum, h) => sum + (h.drinks ?? 0), 0),
  };

  const unit = profile?.weight_unit ?? "kg";
  const latestWeight = weights[0]?.weight_kg ?? null;
  const startWeight = weights[weights.length - 1]?.weight_kg ?? null;

  const todayMealsTotal = meals.reduce(
    (t, m: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) => ({
      kcal: t.kcal + (m.kcal ?? 0),
      protein_g: t.protein_g + (m.protein_g ?? 0),
      carbs_g: t.carbs_g + (m.carbs_g ?? 0),
      fat_g: t.fat_g + (m.fat_g ?? 0),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const ctx = {
    user: {
      name: profile?.display_name ?? null,
      weight_unit: unit,
      weight_goal_kg: profile?.weight_goal_kg ?? null,
      weight_goal_date: profile?.weight_goal_date ?? null,
    },
    today_iso: todayStr,
    aggregates_7d: aggregates,
    weight: {
      latest_kg: latestWeight,
      start_in_window_kg: startWeight,
      recent: weights.slice(0, 5).map((w) => ({ date: w.entry_date, kg: w.weight_kg })),
    },
    today_meals: {
      total: todayMealsTotal,
      items: meals.map((m: { slot: string; description: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }) => ({ slot: m.slot, what: m.description, kcal: m.kcal, p: m.protein_g, c: m.carbs_g, f: m.fat_g })),
    },
    recent_days: entries.slice(0, 10).map((e) => {
      const h = habits.find((x) => x.entry_date === e.entry_date);
      return {
        date: e.entry_date,
        recovery: e.recovery,
        hrv: e.hrv,
        sleep_h: e.sleep_hours,
        sleep_score: e.sleep_score,
        mood: h?.mood ?? null,
        energy: h?.energy ?? null,
        strain: h?.strain ?? null,
        drinks: h?.drinks ?? null,
        hydration_ml: h?.hydration ?? null,
        bedtime: h?.bedtime ?? null,
        last_caffeine: h?.last_caffeine_time ?? null,
        supplements_taken: h?.supplements ?? [],
        work: h?.work_location ?? null,
        note: h?.note ?? null,
      };
    }),
    supplements_in_routine: supps.map((s) => ({
      name: s.name,
      brand: s.brand,
      serving: s.serving_size,
    })),
  };

  return `USER_DATA_CONTEXT (JSON, current as of ${todayStr}):\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\``;
}

function deriveTitle(messages: UIMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");
  return text.length > 60 ? text.slice(0, 57) + "..." : text || "New chat";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend not configured", { status: 500 });
        }
        if (!LOVABLE_API_KEY) {
          return new Response("AI not configured", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        const { threadId, messages } = (await request.json()) as ChatRequestBody;
        if (!threadId || !Array.isArray(messages) || messages.length === 0) {
          return new Response("Bad request", { status: 400 });
        }

        // Verify thread belongs to user
        const { data: thread, error: threadErr } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", threadId)
          .maybeSingle();
        if (threadErr || !thread) {
          return new Response("Thread not found", { status: 404 });
        }

        // Persist the latest user message immediately
        const latest = messages[messages.length - 1];
        if (latest?.role === "user") {
          const { error: insertErr } = await supabase.from("chat_messages").insert({
            thread_id: threadId,
            user_id: userId,
            role: "user",
            parts: latest.parts as never,
          });
          if (insertErr) console.error("[chat] user insert failed", insertErr);
        }

        // Auto-title the thread from the first user message
        if (!thread.title) {
          const title = deriveTitle(messages);
          await supabase.from("chat_threads").update({ title }).eq("id", threadId);
        }

        // Build personalized context
        let contextBlock = "";
        try {
          contextBlock = await buildUserContext(supabase, userId);
        } catch (e) {
          console.error("[chat] context build failed", e);
          contextBlock = "USER_DATA_CONTEXT: (unavailable this request)";
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted) return;
            if (!responseMessage?.parts?.length) return;
            const { error } = await supabase.from("chat_messages").insert({
              thread_id: threadId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as never,
            });
            if (error) console.error("[chat] assistant insert failed", error);
          },
          onError: (err) => {
            console.error("[chat] stream error", err);
            return err instanceof Error ? err.message : "Stream error";
          },
        });
      },
    },
  },
});
