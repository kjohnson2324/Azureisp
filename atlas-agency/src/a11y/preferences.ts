import { z } from 'zod';

/** Stored in profiles.preferences (and locally for offline / shared devices). */
export const Preferences = z.object({
  font: z.enum(['default', 'dyslexia']).default('default'),
  readAloud: z.boolean().default(false),       // auto-read prompts with on-device TTS
  speechRate: z.number().min(0.5).max(1.5).default(1),
  timerMultiplier: z.union([z.literal(1), z.literal(1.5), z.literal(2), z.literal(0)]).default(1), // 0 = untimed
  reduceMotion: z.boolean().default(false),
  highContrastMap: z.boolean().default(false),
  textScale: z.number().min(1).max(2).default(1),
});
export type Preferences = z.infer<typeof Preferences>;

export const defaultPreferences: Preferences = Preferences.parse({});

/** Effective seconds for a timed step, honouring both the student and the assignment. */
export function effectiveSeconds(base: number | null, prefs: Preferences, assignmentMultiplier = 1): number | null {
  if (base === null || prefs.timerMultiplier === 0) return null;
  return Math.round(base * prefs.timerMultiplier * assignmentMultiplier);
}
