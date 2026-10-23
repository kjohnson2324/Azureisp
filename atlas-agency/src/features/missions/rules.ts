import type { GradeBand } from '@/content/schemas';

/**
 * How a case plays at each grade band. Younger agents get fewer stops, fewer
 * choices, concrete clues (flags, animals), and choices from different
 * continents; older agents get inferential clues, look-alike neighbours,
 * map-reading travel clues and an optional timer.
 */
export interface BandRules {
  stops: 3 | 4 | 5;
  choices: 2 | 3 | 4;
  clueDifficulties: readonly (1 | 2 | 3)[];
  cluesPerStop: number;
  suspects: number;
  culpritClues: number;
  travel: 'none' | 'direction' | 'directionDistance';
  distractors: 'otherContinent' | 'mixed' | 'sameContinent';
  /** What a hint reveals about the next country (6-8 choices share a region, so they get the capital). */
  hint: 'continent' | 'capital';
  /** Which countries can appear: well-known ones for younger agents. */
  pool: 'familiar' | 'large' | 'all';
  scoring: { clueSolved: number; hintCost: number; caseSolved: number };
  secondsPerStop: number | null;
}

export const BAND_RULES: Record<GradeBand, BandRules> = {
  'K-2': {
    stops: 3, choices: 2, clueDifficulties: [1], cluesPerStop: 2, suspects: 2, culpritClues: 1,
    travel: 'none', distractors: 'otherContinent', hint: 'continent', pool: 'familiar',
    scoring: { clueSolved: 10, hintCost: 2, caseSolved: 30 }, secondsPerStop: null,
  },
  '3-5': {
    stops: 4, choices: 3, clueDifficulties: [1, 2], cluesPerStop: 2, suspects: 3, culpritClues: 2,
    travel: 'direction', distractors: 'mixed', hint: 'continent', pool: 'large',
    scoring: { clueSolved: 10, hintCost: 5, caseSolved: 50 }, secondsPerStop: null,
  },
  '6-8': {
    stops: 5, choices: 4, clueDifficulties: [2, 3], cluesPerStop: 2, suspects: 4, culpritClues: 2,
    travel: 'directionDistance', distractors: 'sameContinent', hint: 'capital', pool: 'all',
    scoring: { clueSolved: 15, hintCost: 5, caseSolved: 75 }, secondsPerStop: 120,
  },
};

export const BAND_SLUG: Record<GradeBand, string> = { 'K-2': 'gk2', '3-5': 'g35', '6-8': 'g68' };

/** Countries most K-2 students have heard of, spread across six continents. */
export const FAMILIAR_COUNTRIES = [
  'US', 'CA', 'MX', 'CU', 'JM', 'BR', 'AR', 'CL', 'PE', 'CO',
  'GB', 'IE', 'FR', 'DE', 'IT', 'ES', 'PT', 'NL', 'GR', 'SE', 'NO', 'RU',
  'EG', 'KE', 'ZA', 'NG', 'MA', 'ET', 'TZ', 'MG',
  'CN', 'JP', 'IN', 'KR', 'TH', 'VN', 'ID', 'PH', 'TR', 'SA',
  'AU', 'NZ', 'FJ',
] as const;

/** Grades 3-5 also see the 100 largest countries by area. */
export const LARGE_POOL_SIZE = 100;
