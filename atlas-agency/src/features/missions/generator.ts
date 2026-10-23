// Builds a case from the country clue bank, deterministically: the same id
// always yields the same case, so a teacher's assignment is identical for every
// student and works offline. Used at build time to seed `mission:*` content.
import { BAND_RULES, BAND_SLUG, FAMILIAR_COUNTRIES, LARGE_POOL_SIZE } from './rules';
import { LANDMARKS, type LandmarkSource } from '../../../content/missions/source/landmarks';
import { VILLAINS, VILLAIN_IDS, type VillainId } from '../../../content/missions/source/villains';
import { CONTINENTS, SUBREGIONS, continentOf } from '@/features/map/continents';
import { SKILL_STANDARDS } from '../../../content/standards/ngs';
import labelsGeo from '../../../assets/map/labels.geo.json';
import type { ContentEnvelope, Country, GradeBand, Mission } from '@/content/schemas';

/** Small, fast, seedable PRNG (mulberry32). */
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
    shuffle: <T,>(xs: readonly T[]): T[] => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

const L = ([en, es]: readonly [string, string]) => ({ en, es });

const AREA_RANK = new Map(labelsGeo.features.map((f) => [f.properties.iso2, f.properties.rank]));

/** Countries that may appear in a case for this band (the crime scene is always allowed). */
export function countryPool(band: GradeBand, countries: readonly Country[]): Country[] {
  const pool = BAND_RULES[band].pool;
  if (pool === 'all') return [...countries];
  const familiar = new Set<string>(FAMILIAR_COUNTRIES);
  return countries.filter((c) => familiar.has(c.iso2) || (pool === 'large' && (AREA_RANK.get(c.iso2) ?? 999) < LARGE_POOL_SIZE));
}

export function generateMission(landmark: LandmarkSource, band: GradeBand, allCountries: readonly Country[]): ContentEnvelope & { data: Mission } {
  const rules = BAND_RULES[band];
  const countries = countryPool(band, allCountries);
  const id = `mission:${BAND_SLUG[band]}-${landmark.id}`;
  const r = rng(id);
  const byIso = new Map(allCountries.map((c) => [c.iso2, c]));
  const continent = (c: Country) => continentOf(c.region, c.subregion);
  const home = byIso.get(landmark.country);
  if (!home) throw new Error(`${id}: unknown landmark country ${landmark.country}`);

  // 1. Route: the crime scene, then distinct countries.
  const route: Country[] = [home];
  while (route.length < rules.stops) {
    route.push(r.pick(countries.filter((c) => !route.includes(c))));
  }

  // 2. Clues at each stop describe the NEXT stop's country.
  const usedSkills = new Set<string>();
  const stopsSoFar: { clueIds: string[] }[] = [];
  const stops = route.map((here, i) => {
    const next = route[i + 1];
    if (!next) {
      // Arrival clue at the final stop: something about this place not already shown.
      const shown = new Set(route.length > 1 ? stopsSoFar.at(-1)?.clueIds ?? [] : []);
      const fresh = here.clues.filter((k) => k.skill !== 'flag' && !shown.has(k.id));
      return {
        country: here.iso2,
        clueIds: [r.pick(fresh.length ? fresh : here.clues).id],
        hint: { en: "Reread what witnesses said about the thief's clothes and habits.", es: 'Vuelve a leer lo que dijeron los testigos sobre la ropa y las costumbres del culpable.' },
      };
    }
    let pool = next.clues.filter((k) => rules.clueDifficulties.includes(k.difficulty));
    if (pool.length < rules.cluesPerStop) pool = [...next.clues];
    const clues = r.shuffle(pool).slice(0, rules.cluesPerStop);
    clues.forEach((k) => usedSkills.add(k.skill));

    const others = countries.filter((c) => c !== next && c !== here && !route.slice(0, i + 1).includes(c));
    const same = r.shuffle(others.filter((c) => continent(c) === continent(next)));
    const different = r.shuffle(others.filter((c) => continent(c) !== continent(next)));
    const need = rules.choices - 1;
    const distractors =
      rules.distractors === 'sameContinent' ? [...same, ...different].slice(0, need)
      : rules.distractors === 'otherContinent' ? [...different, ...same].slice(0, need)
      : [...same.slice(0, 1), ...different].slice(0, need);
    // A capital that shares the country's name ("Djibouti", "Mexico City") would give the answer away.
    const fold = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    const capitalGivesAway = [next.name.en, next.name.es].some((n) => fold(next.capital.name.en).includes(fold(n)) || fold(next.capital.name.es).includes(fold(n)));
    const hint = rules.hint === 'capital' && !capitalGivesAway
      ? { en: `The next country's capital is ${next.capital.name.en}.`, es: `La capital del siguiente país es ${next.capital.name.es}.` }
      : (() => {
          const where = rules.hint === 'capital'
            ? SUBREGIONS[next.subregion] ?? { en: next.subregion, es: next.subregion }
            : CONTINENTS.find((c) => c.id === continent(next))!.name;
          return { en: `Look in this part of the world: ${where.en}.`, es: `Busca en esta parte del mundo: ${where.es}.` };
        })();

    const stop = {
      country: here.iso2,
      clueIds: clues.map((k) => k.id),
      choices: r.shuffle([next.iso2, ...distractors.map((c) => c.iso2)]),
      hint,
    };
    stopsSoFar.push(stop);
    return stop;
  });

  // 3. Suspects and the dossier.
  const suspects = r.shuffle(VILLAIN_IDS).slice(0, rules.suspects) as VillainId[];
  const culprit = r.pick(suspects);
  const traits = r.shuffle(VILLAINS[culprit].traits).slice(0, rules.culpritClues).map(L);

  const capital = home.capital.name;
  const title = { en: `Who Took ${landmark.name[0]}?`, es: `¿Quién se llevó ${landmark.name[1]}?` };
  const briefing = {
    en: `Agent, ${landmark.name[0]} vanished from ${capital.en} overnight! A Magpie Ring feather was found at the scene. Follow the clues, name the thief, and bring it home.`,
    es: `¡Agente, ${landmark.name[1]} desapareció de ${capital.es} durante la noche! Encontraron una pluma del Anillo Urraca. Sigue las pistas, descubre quién fue y recupera lo robado.`,
  };

  const standards = new Set(['NGS.1', 'NGS.4']);
  for (const skill of usedSkills) for (const s of SKILL_STANDARDS[skill as keyof typeof SKILL_STANDARDS]) standards.add(s);
  if (rules.travel !== 'none') standards.add('NGS.3');

  return {
    id,
    version: 1,
    kind: 'mission',
    grade_bands: [band],
    standard_ids: [...standards].sort(),
    country_codes: [...new Set(route.map((c) => c.iso2))],
    data: {
      title,
      briefing,
      landmark: { name: L(landmark.name), country: landmark.country },
      culprit,
      suspects,
      culpritClues: traits,
      stops,
      scoring: rules.scoring,
      timer: { secondsPerStop: rules.secondsPerStop },
      stamp: `stamp:${landmark.country}`,
      travel: rules.travel,
    },
  };
}

export function generateAllMissions(countries: readonly Country[]) {
  return (['K-2', '3-5', '6-8'] as const).flatMap((band) => LANDMARKS.map((l) => generateMission(l, band, countries)));
}
