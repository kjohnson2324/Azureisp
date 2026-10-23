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
  /** Which unit is shown first for distances; both are always shown. Unset = device setting. */
  units: z.enum(['imperial', 'metric']).optional(),
  /**
   * Rough one-way distance from school to home, in km, picked from a short list.
   * DEVICE-ONLY: never synced (see syncablePreferences). No address, no GPS.
   */
  schoolTripKm: z.number().positive().max(50).default(2),
  /** Compare distances with the class trip (when the teacher set one) or the student's own trip home. */
  tripReference: z.enum(['class', 'home']).default('class'),
});
export type Preferences = z.infer<typeof Preferences>;

export const defaultPreferences: Preferences = Preferences.parse({});

/** Fields that never leave the device. */
export const DEVICE_ONLY_PREFERENCES = ['schoolTripKm'] as const;

/** What may be saved to profiles.preferences on the server. */
export function syncablePreferences(prefs: Preferences): Omit<Preferences, (typeof DEVICE_ONLY_PREFERENCES)[number]> {
  const { schoolTripKm: _deviceOnly, ...rest } = prefs;
  return rest;
}

/** Effective seconds for a timed step, honouring both the student and the assignment. */
export function effectiveSeconds(base: number | null, prefs: Preferences, assignmentMultiplier = 1): number | null {
  if (base === null || prefs.timerMultiplier === 0) return null;
  return Math.round(base * prefs.timerMultiplier * assignmentMultiplier);
}
