// Public API endpoint for iOS meal preset CRUD.
// GET  → list presets for the caller
// POST → create a new preset (body: { name, description?, kcal?, protein_g?, carbs_g?, fat_g? })
// DELETE → delete a preset (body: { id })

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function authedClient(request: Request): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient<Database>>; userId: string }
  | { ok: false; response: Response }
> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, response: new Response("Backend not configured", { status: 500 }) };
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  const token = authHeader.slice(7).trim();
  if (!token) return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }
  return { ok: true, supabase, userId: userData.user.id };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/ios/meal-presets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const a = await authedClient(request);
        if (!a.ok) return a.response;
        const { data, error } = await (a.supabase as any)
          .from("meal_presets")
          .select("id, name, description, kcal, protein_g, carbs_g, fat_g, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return new Response(error.message, { status: 500 });
        return json(data ?? []);
      },
      POST: async ({ request }) => {
        const a = await authedClient(request);
        if (!a.ok) return a.response;
        let body: any;
        try { body = await request.json(); }
        catch { return new Response("Invalid JSON body", { status: 400 }); }
        const name = String(body?.name ?? "").trim();
        if (!name) return new Response("Preset name is required", { status: 400 });
        if (name.length > 120) return new Response("Preset name too long", { status: 400 });
        const num = (v: unknown, int = false) => {
          if (v == null || v === "") return null;
          const n = Number(v);
          if (isNaN(n)) return null;
          return int ? Math.round(n) : n;
        };
        const row = {
          user_id: a.userId,
          name,
          description: String(body?.description ?? "").slice(0, 4000),
          kcal: num(body?.kcal, true),
          protein_g: num(body?.protein_g),
          carbs_g: num(body?.carbs_g),
          fat_g: num(body?.fat_g),
        };
        const { data, error } = await (a.supabase as any)
          .from("meal_presets")
          .insert(row)
          .select("id, name, description, kcal, protein_g, carbs_g, fat_g, created_at")
          .single();
        if (error) return new Response(error.message, { status: 500 });
        return json(data);
      },
      DELETE: async ({ request }) => {
        const a = await authedClient(request);
        if (!a.ok) return a.response;
        let body: any;
        try { body = await request.json(); }
        catch { return new Response("Invalid JSON body", { status: 400 }); }
        const id = String(body?.id ?? "");
        if (!id) return new Response("id required", { status: 400 });
        const { error } = await (a.supabase as any).from("meal_presets").delete().eq("id", id);
        if (error) return new Response(error.message, { status: 500 });
        return json({ ok: true });
      },
    },
  },
});
