// The content contract. Every JSON document in public.content_items.data is
// validated against one of these schemas by the content pipeline before it is
// published, and again on device when a region pack is loaded.
import { z } from 'zod';

export const GRADE_BANDS = ['K-2', '3-5', '6-8'] as const;
export const GradeBand = z.enum(GRADE_BANDS);
export type GradeBand = z.infer<typeof GradeBand>;

export const CLUE_SKILLS = ['flag', 'landmark', 'language', 'currency', 'food', 'animal'] as const;
export const ClueSkill = z.enum(CLUE_SKILLS);
export type ClueSkill = z.infer<typeof ClueSkill>;

export const StandardId = z.string().regex(/^(NGS|TEKS)\.[A-Za-z0-9.()-]+$/);
export const CountryCode = z.string().regex(/^[A-Z]{2}$/);

/** Every player-facing string ships in both launch languages. */
export const Localized = z.object({ en: z.string().min(1), es: z.string().min(1) });
export type Localized = z.infer<typeof Localized>;

const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const LicensedMedia = z.object({
  path: z.string().min(1), // Supabase Storage path, bundled into region packs
  alt: Localized,
  credit: z.string().min(1),
  license: z.enum(['public-domain', 'cc0', 'cc-by', 'cc-by-sa', 'original']),
});

export const Clue = z.object({
  id: z.string().regex(/^[A-Z]{2}-[a-z]+-\d+$/), // e.g. "FR-food-1"
  skill: ClueSkill,
  /** 1 = concrete (K-2), 2 = descriptive (3-5), 3 = inferential (6-8). */
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: Localized,
  /** Standards this clue's skill supports (NGS now; TEKS once mapped). */
  standardIds: z.array(StandardId).min(1),
});
export type Clue = z.infer<typeof Clue>;

export const Country = z.object({
  iso2: CountryCode,
  iso3: z.string().regex(/^[A-Z]{3}$/),
  name: Localized,
  capital: z.object({
    name: Localized,
    coord: LngLat,
    /** Other cities with a capital role (e.g. Bolivia: La Paz). Accepted as answers. */
    alternates: z.array(Localized).optional(),
    /** Shown on the country card where the capital is shared, split or disputed. */
    note: Localized.optional(),
  }),
  region: z.enum(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']),
  subregion: z.string().min(1),
  center: LngLat,
  flag: z.object({ path: z.string().min(1), alt: Localized }),
  languages: z.array(Localized).min(1),
  currency: z.object({ code: z.string().regex(/^[A-Z]{3}$/), name: Localized }),
  greeting: z.object({
    text: z.string().min(1), // "Bonjour"
    ttsLang: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/), // BCP-47 voice for on-device TTS
    meaning: Localized,
  }),
  facts: z.array(Localized).min(2).max(6),
  photo: LicensedMedia.optional(),
  clues: z.array(Clue).length(5),
}).superRefine((c, ctx) => {
  if (new Set(c.clues.map((k) => k.skill)).size !== c.clues.length) {
    ctx.addIssue({ code: 'custom', path: ['clues'], message: 'each clue must cover a different skill' });
  }
  c.clues.forEach((k, i) => {
    if (!k.id.startsWith(`${c.iso2}-`)) ctx.addIssue({ code: 'custom', path: ['clues', i, 'id'], message: 'clue id must start with the country code' });
  });
});
export type Country = z.infer<typeof Country>;

export const VillainId = z.enum([
  'velvet-vex',
  'professor-pocket',
  'lady-lumen',
  'sticky-fitz',
  'dot-dash',
]);

export const MissionStop = z.object({
  country: CountryCode,
  /** Clues found here point to the NEXT stop. Final stop clues describe the culprit. */
  clueIds: z.array(z.string()).min(1).max(3),
  /** Destinations offered at this stop (includes the right one); omitted on the final stop. */
  choices: z.array(CountryCode).min(2).max(4).optional(),
  hint: Localized,
});

export const Mission = z
  .object({
    title: Localized,
    briefing: Localized,
    landmark: z.object({ name: Localized, country: CountryCode, photo: LicensedMedia.optional() }),
    culprit: VillainId,
    suspects: z.array(VillainId).min(2).max(5),
    culpritClues: z.array(Localized).min(1).max(3),
    stops: z.array(MissionStop).min(3).max(5),
    scoring: z.object({
      clueSolved: z.number().int().positive(),
      hintCost: z.number().int().positive(),
      caseSolved: z.number().int().positive(),
    }),
    timer: z.object({ secondsPerStop: z.number().int().min(30).nullable() }),
    stamp: z.string().regex(/^stamp:[A-Z]{2}$/),
    /** Extra clue computed from the map: none, "flew east", or "flew about 5,600 miles east". */
    travel: z.enum(['none', 'direction', 'directionDistance']).default('none'),
  })
  .superRefine((m, ctx) => {
    m.stops.forEach((stop, i) => {
      const next = m.stops[i + 1];
      if (next && !stop.choices?.includes(next.country)) {
        ctx.addIssue({ code: 'custom', path: ['stops', i, 'choices'], message: `must include next stop ${next.country}` });
      }
      if (!next && stop.choices) {
        ctx.addIssue({ code: 'custom', path: ['stops', i, 'choices'], message: 'final stop has no destinations' });
      }
    });
    if (!m.suspects.includes(m.culprit)) {
      ctx.addIssue({ code: 'custom', path: ['suspects'], message: 'culprit must be a suspect' });
    }
  });
export type Mission = z.infer<typeof Mission>;

/** Row-level envelope shared by every content item (mirrors public.content_items). */
export const ContentEnvelope = z.object({
  id: z.string().regex(/^[a-z_]+:[A-Za-z0-9._-]+$/),
  version: z.number().int().positive(),
  kind: z.enum(['country', 'question', 'mission', 'spelling_list', 'badge', 'avatar_item', 'villain']),
  grade_bands: z.array(GradeBand),
  standard_ids: z.array(StandardId),
  country_codes: z.array(CountryCode),
  data: z.unknown(),
});
export type ContentEnvelope = z.infer<typeof ContentEnvelope>;
