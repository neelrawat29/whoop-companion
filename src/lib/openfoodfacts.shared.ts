// Open Food Facts barcode lookup. No API key needed.
// Returns null when the barcode is unknown or the product has no useful macros.

export type BarcodeLookup = {
  barcode: string;
  name: string;
  brand: string | null;
  serving_g: number | null; // grams per serving if OFF gives it
  kcal_per_100g: number | null;
  protein_per_100g: number | null;
  carbs_per_100g: number | null;
  fat_per_100g: number | null;
  // Convenience: macros scaled to serving (if serving known), else per 100 g
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  scaled_to: "serving" | "100g";
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export function validateBarcode(raw: string | undefined | null): string {
  const s = String(raw ?? "").replace(/\D/g, "");
  if (s.length < 6 || s.length > 14) throw new Error("Barcode must be 6–14 digits");
  return s;
}

export async function lookupBarcode(rawBarcode: string): Promise<BarcodeLookup | null> {
  const barcode = validateBarcode(rawBarcode);
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,serving_quantity,nutriments`,
    { headers: { "User-Agent": "Cove/1.0 (barcode lookup)" } },
  );
  if (!res.ok) throw new Error(`Barcode lookup failed (${res.status})`);
  const json: any = await res.json();
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};
  const kcal100 = num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) ? num(n["energy_100g"])! / 4.184 : null);
  const protein100 = num(n.proteins_100g);
  const carbs100 = num(n.carbohydrates_100g);
  const fat100 = num(n.fat_100g);
  const serving = num(p.serving_quantity);

  const scaled_to: "serving" | "100g" = serving && serving > 0 ? "serving" : "100g";
  const factor = scaled_to === "serving" ? (serving as number) / 100 : 1;
  const round1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10);

  return {
    barcode,
    name: (p.product_name || "Unknown product").toString().slice(0, 200),
    brand: p.brands ? String(p.brands).split(",")[0].trim().slice(0, 100) : null,
    serving_g: serving ?? null,
    kcal_per_100g: kcal100 == null ? null : Math.round(kcal100),
    protein_per_100g: round1(protein100),
    carbs_per_100g: round1(carbs100),
    fat_per_100g: round1(fat100),
    kcal: kcal100 == null ? null : Math.round(kcal100 * factor),
    protein_g: round1(protein100 == null ? null : protein100 * factor),
    carbs_g: round1(carbs100 == null ? null : carbs100 * factor),
    fat_g: round1(fat100 == null ? null : fat100 * factor),
    scaled_to,
  };
}
