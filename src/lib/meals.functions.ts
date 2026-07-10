import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  runMealEstimate,
  runMealEstimateFromPhoto,
  validateMealEstimateInput,
  validateMealPhotoInput,
  type MealEstimateInput,
  type MealPhotoInput,
} from "@/lib/meals.shared";
import { lookupBarcode as offLookup } from "@/lib/openfoodfacts.shared";

export const estimateMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: MealEstimateInput) => validateMealEstimateInput(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    return runMealEstimate(data, apiKey);
  });

export const estimateMealFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: MealPhotoInput) => validateMealPhotoInput(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    return runMealEstimateFromPhoto(data, apiKey);
  });

export const lookupMealBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { barcode: string }) => {
    if (!data?.barcode || typeof data.barcode !== "string") throw new Error("barcode required");
    return { barcode: data.barcode };
  })
  .handler(async ({ data }) => offLookup(data.barcode));

// ---------------- Meal presets CRUD ----------------

export type MealPresetDTO = {
  id: string;
  name: string;
  description: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  created_at: string;
};

export const listMealPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MealPresetDTO[]> => {
    const { data, error } = await (context.supabase as any)
      .from("meal_presets")
      .select("id, name, description, kcal, protein_g, carbs_g, fat_g, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as MealPresetDTO[];
  });

export const saveMealPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    name: string;
    description?: string;
    kcal?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
  }) => {
    if (!data?.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      throw new Error("Preset name is required");
    }
    if (data.name.length > 120) throw new Error("Preset name too long");
    return {
      name: data.name.trim(),
      description: (data.description ?? "").toString().slice(0, 4000),
      kcal: data.kcal == null || isNaN(Number(data.kcal)) ? null : Math.round(Number(data.kcal)),
      protein_g: data.protein_g == null || isNaN(Number(data.protein_g)) ? null : Number(data.protein_g),
      carbs_g: data.carbs_g == null || isNaN(Number(data.carbs_g)) ? null : Number(data.carbs_g),
      fat_g: data.fat_g == null || isNaN(Number(data.fat_g)) ? null : Number(data.fat_g),
    };
  })
  .handler(async ({ data, context }): Promise<MealPresetDTO> => {
    const { data: row, error } = await (context.supabase as any)
      .from("meal_presets")
      .insert({ ...data, user_id: context.userId })
      .select("id, name, description, kcal, protein_g, carbs_g, fat_g, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as MealPresetDTO;
  });

export const deleteMealPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id || typeof data.id !== "string") throw new Error("id required");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("meal_presets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Recent meals ----------------

export type RecentMealDTO = {
  description: string;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  last_used: string;
};

export const listRecentMeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecentMealDTO[]> => {
    const { data, error } = await (context.supabase as any)
      .from("meals")
      .select("description, kcal, protein_g, carbs_g, fat_g, created_at")
      .not("description", "is", null)
      .neq("description", "")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const seen = new Set<string>();
    const recents: RecentMealDTO[] = [];
    for (const row of data ?? []) {
      const key = String(row.description).trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recents.push({
        description: row.description,
        kcal: row.kcal,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
        last_used: row.created_at,
      });
      if (recents.length >= 10) break;
    }
    return recents;
  });
