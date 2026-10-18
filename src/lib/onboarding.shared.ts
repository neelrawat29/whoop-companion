import { z } from "zod";

// Setup answers Cove needs before it can personalise targets. All required.
export const onboardingProfileSchema = z.object({
  goal: z.enum(["lose", "maintain", "gain"]),
  activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  sex: z.enum(["male", "female", "other"]),
  birth_year: z
    .number()
    .int()
    .refine((y) => {
      const age = new Date().getFullYear() - y;
      return age >= 16 && age <= 100;
    }, "Age must be between 16 and 100"),
  height_cm: z.number().min(100).max(250),
  weight_kg: z.number().min(30).max(300),
});

export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
