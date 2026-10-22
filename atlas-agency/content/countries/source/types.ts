// Authoring format for country content. The build (scripts/build-countries.ts)
// merges this with CLDR names (Node Intl) and Natural Earth geography, then
// validates the result against src/content/schemas.ts.
//
// Writing rules (enforced by the build where possible):
//   * Clues point TO the country, so they never contain its English or Spanish name.
//   * English clues start from "The thief …". Spanish clues drop the subject
//     ("Preguntó …") so grammatical gender never gives away which suspect it is.
//   * Flag text is a plain description. It doubles as the flag's alt text and
//     becomes the flag clue ("The thief sketched a flag: …").
//   * Facts are stable over time (no population counts, no "current" leaders).

/** [English, Spanish] */
export type L = readonly [en: string, es: string];

export type AuthoredSkill = 'landmark' | 'food' | 'animal' | 'language' | 'currency';

export interface CountrySource {
  /** English capital name, or [en, es] when Spanish differs. */
  capital: string | L;
  capitalAlternates?: readonly (string | L)[];
  capitalNote?: L;
  /** [lng, lat]; required only when Natural Earth has no matching capital point. */
  capitalCoord?: readonly [number, number];
  /** Overrides CLDR's country name where CLDR's form is awkward for kids. */
  name?: L;
  /** [text, BCP-47 voice] or [text, voice, meaning]. Meaning defaults to Hello / Hola. */
  greeting: readonly [string, string] | readonly [string, string, L];
  /** ISO 639 codes resolved through CLDR, or explicit [en, es] names. */
  languages: readonly (string | L)[];
  /** ISO 4217 code; currencyName only when CLDR lacks it. */
  currency: string;
  currencyName?: L;
  flag: L;
  /** Exactly four of the five authored skills. The flag clue is generated. */
  clues: Partial<Record<AuthoredSkill, L>>;
  difficulty?: Partial<Record<AuthoredSkill | 'flag', 1 | 2 | 3>>;
  facts: readonly [L, L, ...L[]];
}

export type RegionSource = Readonly<Record<string, CountrySource>>;
