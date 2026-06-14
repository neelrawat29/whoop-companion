// Pure biological age scorer. No Supabase / framework imports.
// Reused by server functions and (potentially) tests.

export type Sex = "male" | "female" | "other";

export type DailyEntry = {
  entry_date: string;
  recovery: number | null;
  hrv: number | null;
  rhr: number | null;
  sleep_hours: number | null;
};

export type HabitsLog = {
  entry_date: string;
  bedtime: string | null;
  drinks: number | null;
  hydration: number | null;
  energy: number | null;
  mood: number | null;
};

export type MealRow = {
  entry_date: string;
  kcal: number | null;
  protein_g: number | null;
};

export type ProfileBaseline = {
  date_of_birth: string | null;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  resting_hr_baseline: number | null;
};

export type Modifier = {
  domain: "Cardio" | "Sleep" | "Recovery" | "Body" | "Lifestyle" | "Nutrition";
  label: string;
  years: number; // negative = younger, positive = older
};

export type BioAgeResult = {
  ready: boolean;
  reason?: string;
  chronological: number | null;
  biological: number | null;
  delta: number | null;
  confidence: number; // 0..1
  modifiers: Modifier[];
  domainTotals: { domain: Modifier["domain"]; years: number }[];
  daysLogged: number;
  missingInputs: string[];
};

const MAX_DELTA = 15;

// ---------- helpers ----------
function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function stdev(nums: number[]) {
  if (nums.length < 2) return null;
  const m = avg(nums)!;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}
function bedtimeToMinutesFromNoon(t: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  // Normalize so "23:30" and "01:00" are close numerically.
  let mins = h * 60 + m;
  if (mins < 12 * 60) mins += 24 * 60; // wrap early-morning to next day
  return mins;
}

export function calcChronologicalAge(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Age/sex norms (approximations from population RHR/HRV references).
function rhrNorm(age: number, sex: Sex): number {
  const buckets: [number, number, number][] = [
    // [maxAge, male, female]
    [25, 63, 67],
    [35, 65, 69],
    [45, 67, 71],
    [55, 68, 73],
    [65, 69, 73],
    [120, 67, 71],
  ];
  for (const [maxA, mNorm, fNorm] of buckets) {
    if (age <= maxA) {
      if (sex === "male") return mNorm;
      if (sex === "female") return fNorm;
      return (mNorm + fNorm) / 2;
    }
  }
  return 70;
}
function hrvNorm(age: number): number {
  if (age < 30) return 55;
  if (age < 40) return 45;
  if (age < 50) return 35;
  if (age < 60) return 30;
  if (age < 70) return 25;
  return 20;
}

// ---------- main ----------
export function scoreBiologicalAge(input: {
  profile: ProfileBaseline;
  entries: DailyEntry[]; // up to 30 days
  habits: HabitsLog[];
  meals: MealRow[];
  now?: Date;
}): BioAgeResult {
  const now = input.now ?? new Date();
  const chronological = calcChronologicalAge(input.profile.date_of_birth, now);
  const missing: string[] = [];
  if (!input.profile.date_of_birth) missing.push("Date of birth");
  if (!input.profile.sex) missing.push("Sex");

  if (chronological == null || !input.profile.sex) {
    return {
      ready: false,
      reason: "Add date of birth and sex in Settings to unlock Biological Age.",
      chronological,
      biological: null,
      delta: null,
      confidence: 0,
      modifiers: [],
      domainTotals: [],
      daysLogged: input.entries.length,
      missingInputs: missing,
    };
  }

  const daysLogged = new Set(input.entries.map((e) => e.entry_date)).size;
  if (daysLogged < 10) {
    return {
      ready: false,
      reason: `Log at least 10 days in the last 30 to unlock your score (you have ${daysLogged}).`,
      chronological,
      biological: null,
      delta: null,
      confidence: daysLogged / 10,
      modifiers: [],
      domainTotals: [],
      daysLogged,
      missingInputs: missing,
    };
  }

  const sex = input.profile.sex;
  const mods: Modifier[] = [];
  const domainsWithData = new Set<Modifier["domain"]>();

  // ----- Cardio -----
  const rhrs = input.entries.map((e) => e.rhr).filter((v): v is number => v != null);
  const userRhr = input.profile.resting_hr_baseline ?? (rhrs.length >= 5 ? avg(rhrs) : null);
  if (userRhr != null) {
    domainsWithData.add("Cardio");
    const norm = rhrNorm(chronological, sex);
    const diff = userRhr - norm; // positive = higher RHR = older
    const years = Math.max(-3, Math.min(3, diff / 5));
    if (Math.abs(years) >= 0.25) {
      mods.push({
        domain: "Cardio",
        label: `Resting HR ${Math.round(userRhr)} bpm vs ${norm} norm`,
        years: Math.round(years * 10) / 10,
      });
    }
  }
  const hrvs = input.entries.map((e) => e.hrv).filter((v): v is number => v != null);
  const userHrv = hrvs.length >= 5 ? avg(hrvs) : null;
  if (userHrv != null) {
    domainsWithData.add("Cardio");
    const norm = hrvNorm(chronological);
    const diff = userHrv - norm; // positive = higher HRV = younger
    const years = Math.max(-3, Math.min(3, -diff / 10));
    if (Math.abs(years) >= 0.25) {
      mods.push({
        domain: "Cardio",
        label: `HRV ${Math.round(userHrv)} ms vs ${norm} norm`,
        years: Math.round(years * 10) / 10,
      });
    }
  }

  // ----- Recovery -----
  const recs = input.entries.map((e) => e.recovery).filter((v): v is number => v != null);
  const avgRec = avg(recs);
  if (avgRec != null) {
    domainsWithData.add("Recovery");
    let years = 0;
    if (avgRec >= 70) years = -2;
    else if (avgRec >= 50) years = 0;
    else years = 2;
    if (years !== 0)
      mods.push({
        domain: "Recovery",
        label: `Avg recovery ${Math.round(avgRec)}%`,
        years,
      });
  }

  // ----- Sleep -----
  const sleeps = input.entries.map((e) => e.sleep_hours).filter((v): v is number => v != null);
  const avgSleep = avg(sleeps);
  if (avgSleep != null) {
    domainsWithData.add("Sleep");
    let years = 0;
    if (avgSleep >= 7 && avgSleep <= 9) years = -1;
    else if ((avgSleep >= 6 && avgSleep < 7) || (avgSleep > 9 && avgSleep <= 10)) years = 0;
    else years = 2;
    if (years !== 0)
      mods.push({
        domain: "Sleep",
        label: `Avg sleep ${avgSleep.toFixed(1)}h`,
        years,
      });
  }
  const bedtimes = input.habits
    .map((h) => bedtimeToMinutesFromNoon(h.bedtime))
    .filter((v): v is number => v != null);
  const bedSd = stdev(bedtimes);
  if (bedSd != null && bedtimes.length >= 5) {
    domainsWithData.add("Sleep");
    let years = 0;
    if (bedSd < 45) years = -1;
    else if (bedSd > 90) years = 1;
    if (years !== 0)
      mods.push({
        domain: "Sleep",
        label: `Bedtime consistency ${Math.round(bedSd)}min`,
        years,
      });
  }

  // ----- Body -----
  const { height_cm, weight_kg } = input.profile;
  if (height_cm && weight_kg && height_cm > 0) {
    domainsWithData.add("Body");
    const bmi = weight_kg / (height_cm / 100) ** 2;
    let years = 0;
    if (bmi >= 18.5 && bmi < 25) years = -1;
    else if (bmi >= 25 && bmi < 30) years = 0;
    else years = 2;
    if (years !== 0)
      mods.push({
        domain: "Body",
        label: `BMI ${bmi.toFixed(1)}`,
        years,
      });
  } else {
    missing.push("Height & weight");
  }

  // ----- Lifestyle -----
  const energies = input.habits.map((h) => h.energy).filter((v): v is number => v != null);
  const moods = input.habits.map((h) => h.mood).filter((v): v is number => v != null);
  const emCombined = [...energies, ...moods];
  if (emCombined.length >= 5) {
    domainsWithData.add("Lifestyle");
    const m = avg(emCombined)!;
    let years = 0;
    if (m >= 4) years = -1;
    else if (m <= 2) years = 1;
    if (years !== 0)
      mods.push({
        domain: "Lifestyle",
        label: `Energy & mood avg ${m.toFixed(1)}/5`,
        years,
      });
  }
  const hydrations = input.habits.map((h) => h.hydration).filter((v): v is number => v != null);
  const avgHyd = avg(hydrations);
  if (avgHyd != null) {
    domainsWithData.add("Lifestyle");
    let years = 0;
    if (avgHyd >= 6) years = -0.5;
    else if (avgHyd < 3) years = 1;
    if (years !== 0)
      mods.push({
        domain: "Lifestyle",
        label: `Hydration ${avgHyd.toFixed(1)} glasses/day`,
        years,
      });
  }
  const drinks = input.habits.map((h) => h.drinks).filter((v): v is number => v != null);
  const avgDrinks = avg(drinks);
  if (avgDrinks != null) {
    domainsWithData.add("Lifestyle");
    let years = 0;
    if (avgDrinks >= 2) years = 2;
    else if (avgDrinks <= 0.5) years = -0.5;
    if (years !== 0)
      mods.push({
        domain: "Lifestyle",
        label: `Alcohol ${avgDrinks.toFixed(1)} drinks/day`,
        years,
      });
  }
  // Logging consistency
  if (daysLogged >= 25) {
    domainsWithData.add("Lifestyle");
    mods.push({ domain: "Lifestyle", label: `Logged ${daysLogged}/30 days`, years: -0.5 });
  }

  // ----- Nutrition -----
  if (weight_kg && input.meals.length > 0) {
    domainsWithData.add("Nutrition");
    // Group meals by day to compute per-day totals
    const byDay = new Map<string, { kcal: number; protein: number; count: number }>();
    for (const m of input.meals) {
      const d = byDay.get(m.entry_date) ?? { kcal: 0, protein: 0, count: 0 };
      d.kcal += m.kcal ?? 0;
      d.protein += Number(m.protein_g ?? 0);
      d.count += 1;
      byDay.set(m.entry_date, d);
    }
    const days = [...byDay.values()];
    const protAvg = avg(days.map((d) => d.protein));
    if (protAvg != null && protAvg >= 1.2 * weight_kg) {
      mods.push({
        domain: "Nutrition",
        label: `Protein ${Math.round(protAvg)}g/day (≥1.2 g/kg)`,
        years: -0.5,
      });
    }
    const kcals = days.map((d) => d.kcal).filter((k) => k > 0);
    const kcalSd = stdev(kcals);
    const kcalAvg = avg(kcals);
    if (kcalSd != null && kcalAvg && kcalAvg > 0 && kcalSd / kcalAvg > 0.4) {
      mods.push({
        domain: "Nutrition",
        label: `High day-to-day calorie swings`,
        years: 0.5,
      });
    }
    const mealsPerDay = avg(days.map((d) => d.count));
    if (mealsPerDay != null && mealsPerDay >= 3) {
      mods.push({ domain: "Nutrition", label: `Avg ${mealsPerDay.toFixed(1)} meals/day logged`, years: -0.5 });
    }
  }

  // Confidence = fraction of 6 domains that contributed data.
  const confidence = Math.min(1, domainsWithData.size / 6);

  // If low confidence, cap the delta tighter.
  const cap = confidence < 0.5 ? 3 : MAX_DELTA;
  const rawDelta = mods.reduce((s, m) => s + m.years, 0);
  const delta = Math.max(-cap, Math.min(cap, rawDelta));
  const biological = Math.max(18, Math.min(100, Math.round((chronological + delta) * 10) / 10));

  const domainTotals = (
    ["Cardio", "Sleep", "Recovery", "Body", "Lifestyle", "Nutrition"] as Modifier["domain"][]
  ).map((d) => ({
    domain: d,
    years: Math.round(mods.filter((m) => m.domain === d).reduce((s, m) => s + m.years, 0) * 10) / 10,
  }));

  return {
    ready: true,
    chronological,
    biological,
    delta: Math.round(delta * 10) / 10,
    confidence,
    modifiers: mods.sort((a, b) => Math.abs(b.years) - Math.abs(a.years)),
    domainTotals,
    daysLogged,
    missingInputs: missing,
  };
}
