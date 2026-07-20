// Shared recap logic used by web server fns and the iOS public API routes.

export type RecapMealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type RecapDefaults = {
  date: string;
  missing: {
    metrics: boolean;
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    water: boolean;
    weight: boolean;
    energy: boolean;
    mood: boolean;
    bedtime: boolean;
  };
  current: {
    metrics: { recovery: number | null; hrv: number | null; rhr: number | null; sleep_hours: number | null };
    habits: { energy: number | null; mood: number | null; hydration: number | null; bedtime: string | null };
    weight_kg: number | null;
    meal_slots: Record<RecapMealSlot, boolean>;
  };
  defaults: {
    hydration: number | null;
    energy: number | null;
    mood: number | null;
    bedtime: string | null;
    weight_kg: number | null;
    sleep_target_hours: number | null;
    last_meal_by_slot: Partial<Record<RecapMealSlot, { description: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | null>>;
  };
};

export type RecapSavePayload = {
  metrics?: { recovery?: number | null; hrv?: number | null; rhr?: number | null; sleep_hours?: number | null; sleep_score?: number | null };
  habits?: { energy?: number | null; mood?: number | null; hydration?: number | null; bedtime?: string | null };
  weight_kg?: number | null;
  meals?: Array<{ slot: RecapMealSlot; description: string; kcal?: number | null; protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null }>;
};

export function todayISO(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function median(vals: number[]): number | null {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export async function buildRecapDefaults(supabase: any, userId: string, now = new Date()): Promise<RecapDefaults> {
  const date = todayISO(now);
  const weekAgo = isoDaysAgo(7, now);

  const [entryRes, habitsRes, mealsRes, weightRes, weekHabitsRes, weekWeightRes, weekMealsRes, profileRes] = await Promise.all([
    supabase.from("daily_entries").select("recovery,hrv,rhr,sleep_hours").eq("user_id", userId).eq("entry_date", date).maybeSingle(),
    supabase.from("habits_log").select("energy,mood,hydration,bedtime").eq("user_id", userId).eq("entry_date", date).maybeSingle(),
    supabase.from("meals").select("slot").eq("user_id", userId).eq("entry_date", date),
    supabase.from("weight_entries").select("weight_kg").eq("user_id", userId).eq("entry_date", date).maybeSingle(),
    supabase.from("habits_log").select("energy,mood,hydration,bedtime").eq("user_id", userId).gte("entry_date", weekAgo).lt("entry_date", date),
    supabase.from("weight_entries").select("weight_kg,entry_date").eq("user_id", userId).lt("entry_date", date).order("entry_date", { ascending: false }).limit(1),
    supabase.from("meals").select("slot,description,kcal,protein_g,carbs_g,fat_g,created_at").eq("user_id", userId).gte("entry_date", weekAgo).lt("entry_date", date).order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("sleep_target_hours").eq("id", userId).maybeSingle(),
  ]);

  const entry = entryRes.data ?? null;
  const habits = habitsRes.data ?? null;
  const mealsToday = (mealsRes.data ?? []) as Array<{ slot: string }>;
  const weightToday = weightRes.data ?? null;
  const weekHabits = (weekHabitsRes.data ?? []) as Array<any>;
  const lastWeight = (weekWeightRes.data ?? [])[0] ?? null;
  const weekMeals = (weekMealsRes.data ?? []) as Array<any>;
  const profile = profileRes.data ?? null;

  const slotSet = new Set<string>(mealsToday.map((m) => m.slot));
  const meal_slots: Record<RecapMealSlot, boolean> = {
    breakfast: slotSet.has("breakfast"),
    lunch: slotSet.has("lunch"),
    dinner: slotSet.has("dinner"),
    snack: slotSet.has("snack"),
  };

  const lastBySlot: RecapDefaults["defaults"]["last_meal_by_slot"] = {};
  for (const slot of ["breakfast", "lunch", "dinner", "snack"] as RecapMealSlot[]) {
    const found = weekMeals.find((m) => m.slot === slot && m.description);
    lastBySlot[slot] = found
      ? { description: found.description, kcal: found.kcal ?? null, protein_g: found.protein_g ?? null, carbs_g: found.carbs_g ?? null, fat_g: found.fat_g ?? null }
      : null;
  }

  const energyMedian = median(weekHabits.map((h) => h.energy).filter((v) => typeof v === "number"));
  const moodMedian = median(weekHabits.map((h) => h.mood).filter((v) => typeof v === "number"));
  const hydrationAvg = avg(weekHabits.map((h) => h.hydration).filter((v) => typeof v === "number" && v > 0));
  const bedtimes = weekHabits.map((h) => h.bedtime).filter(Boolean) as string[];
  const bedtimeDefault = bedtimes.length ? bedtimes[0].slice(0, 5) : null;

  return {
    date,
    missing: {
      metrics: !entry || (entry.recovery == null && entry.hrv == null && entry.sleep_hours == null),
      breakfast: !meal_slots.breakfast,
      lunch: !meal_slots.lunch,
      dinner: !meal_slots.dinner,
      water: !habits || habits.hydration == null || habits.hydration === 0,
      weight: !weightToday,
      energy: !habits || habits.energy == null,
      mood: !habits || habits.mood == null,
      bedtime: !habits || !habits.bedtime,
    },
    current: {
      metrics: {
        recovery: entry?.recovery ?? null,
        hrv: entry?.hrv ?? null,
        rhr: entry?.rhr ?? null,
        sleep_hours: entry?.sleep_hours ?? null,
      },
      habits: {
        energy: habits?.energy ?? null,
        mood: habits?.mood ?? null,
        hydration: habits?.hydration ?? null,
        bedtime: habits?.bedtime ?? null,
      },
      weight_kg: weightToday?.weight_kg ?? null,
      meal_slots,
    },
    defaults: {
      hydration: hydrationAvg != null ? Math.round(hydrationAvg) : null,
      energy: energyMedian != null ? Math.round(energyMedian) : null,
      mood: moodMedian != null ? Math.round(moodMedian) : null,
      bedtime: bedtimeDefault,
      weight_kg: lastWeight?.weight_kg ?? null,
      sleep_target_hours: profile?.sleep_target_hours ?? null,
      last_meal_by_slot: lastBySlot,
    },
  };
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export function validateRecapPayload(input: unknown): RecapSavePayload {
  const d = (input ?? {}) as any;
  const out: RecapSavePayload = {};
  if (d.metrics && typeof d.metrics === "object") {
    out.metrics = {
      recovery: num(d.metrics.recovery),
      hrv: num(d.metrics.hrv),
      rhr: num(d.metrics.rhr),
      sleep_hours: num(d.metrics.sleep_hours),
      sleep_score: num(d.metrics.sleep_score),
    };
  }
  if (d.habits && typeof d.habits === "object") {
    out.habits = {
      energy: num(d.habits.energy),
      mood: num(d.habits.mood),
      hydration: num(d.habits.hydration),
      bedtime: typeof d.habits.bedtime === "string" && d.habits.bedtime ? d.habits.bedtime.slice(0, 8) : null,
    };
  }
  if (d.weight_kg != null) out.weight_kg = num(d.weight_kg);
  if (Array.isArray(d.meals)) {
    out.meals = d.meals
      .filter((m: any) => m && typeof m.slot === "string" && typeof m.description === "string" && m.description.trim())
      .slice(0, 20)
      .map((m: any) => ({
        slot: m.slot as RecapMealSlot,
        description: String(m.description).slice(0, 500),
        kcal: num(m.kcal),
        protein_g: num(m.protein_g),
        carbs_g: num(m.carbs_g),
        fat_g: num(m.fat_g),
      }));
  }
  return out;
}

export type RecapSaveResult = {
  ok: true;
  wrote: { metrics: boolean; habits: boolean; weight: boolean; meals: number };
};

export async function saveRecapPayload(supabase: any, userId: string, payload: RecapSavePayload, now = new Date()): Promise<RecapSaveResult> {
  const date = todayISO(now);
  const wrote = { metrics: false, habits: false, weight: false, meals: 0 };

  if (payload.metrics && Object.values(payload.metrics).some((v) => v != null)) {
    const row: any = { user_id: userId, entry_date: date, source: "recap" };
    for (const k of ["recovery", "hrv", "rhr", "sleep_hours", "sleep_score"] as const) {
      if (payload.metrics[k] != null) row[k] = payload.metrics[k];
    }
    const { error } = await supabase.from("daily_entries").upsert(row, { onConflict: "user_id,entry_date" });
    if (error) throw new Error(error.message);
    wrote.metrics = true;
  }

  if (payload.habits && Object.values(payload.habits).some((v) => v != null && v !== "")) {
    const row: any = { user_id: userId, entry_date: date };
    for (const k of ["energy", "mood", "hydration", "bedtime"] as const) {
      if (payload.habits[k] != null) row[k] = payload.habits[k];
    }
    const { error } = await supabase.from("habits_log").upsert(row, { onConflict: "user_id,entry_date" });
    if (error) throw new Error(error.message);
    wrote.habits = true;
  }

  if (payload.weight_kg != null) {
    const { error } = await supabase.from("weight_entries").upsert(
      { user_id: userId, entry_date: date, weight_kg: payload.weight_kg },
      { onConflict: "user_id,entry_date" },
    );
    if (error) throw new Error(error.message);
    wrote.weight = true;
  }

  if (payload.meals && payload.meals.length) {
    const rows = payload.meals.map((m) => ({
      user_id: userId,
      entry_date: date,
      slot: m.slot,
      description: m.description,
      kcal: m.kcal,
      protein_g: m.protein_g,
      carbs_g: m.carbs_g,
      fat_g: m.fat_g,
      source: "recap",
    }));
    const { error } = await supabase.from("meals").insert(rows);
    if (error) throw new Error(error.message);
    wrote.meals = rows.length;
  }

  return { ok: true, wrote };
}
