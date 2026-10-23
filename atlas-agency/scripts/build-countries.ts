/// <reference types="node" />
// Builds the 195-country content set.
//
//   npx tsx scripts/build-countries.ts          build + validate + write outputs
//   npx tsx scripts/build-countries.ts --check  validate only (CI)
//
// Inputs:  content/countries/source/*.ts      hand-authored clues, facts, greetings
//          content/natural-earth/ne-extract.json  region, subregion, label point, capital points
//          Node Intl (Unicode CLDR)           country, language and currency names in en/es
//          node_modules/flag-icons            MIT-licensed SVG flags
// Outputs: content/countries/dist/countries.json
//          content/countries/dist/review.csv    every clue and fact, for educator review
//          content/flags/<iso2>.svg, src/content/flagAssets.ts (static requires for Metro)
//          supabase/seed.sql

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Country, type Clue } from '../src/content/schemas';
import africa from '../content/countries/source/africa';
import americas from '../content/countries/source/americas';
import asia from '../content/countries/source/asia';
import europe from '../content/countries/source/europe';
import oceania from '../content/countries/source/oceania';
import { NGS_STANDARDS, SKILL_STANDARDS } from '../content/standards/ngs';
import { CONTINENTS, continentOf } from '../src/features/map/continents';
import type { AuthoredSkill, CountrySource, L, RegionSource } from '../content/countries/source/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const REGIONS: Record<string, RegionSource> = { Africa: africa, Americas: americas, Asia: asia, Europe: europe, Oceania: oceania };

type NE = {
  countries: Record<string, { iso3: string; region: string; subregion: string; label: [number, number] }>;
  capitals: Record<string, { name: string; coord: [number, number] }[]>;
};
const ne: NE = JSON.parse(readFileSync(join(root, 'content/natural-earth/ne-extract.json'), 'utf8'));

const cldr = {
  region: { en: new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }), es: new Intl.DisplayNames(['es'], { type: 'region', fallback: 'none' }) },
  language: { en: new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' }), es: new Intl.DisplayNames(['es'], { type: 'language', fallback: 'none' }) },
  currency: { en: new Intl.DisplayNames(['en'], { type: 'currency', fallback: 'none' }), es: new Intl.DisplayNames(['es'], { type: 'currency', fallback: 'none' }) },
};

const DEFAULT_DIFFICULTY: Record<AuthoredSkill | 'flag', 1 | 2 | 3> = {
  flag: 1, animal: 1, landmark: 2, food: 2, language: 2, currency: 3,
};

const errors: string[] = [];
const fail = (iso2: string, msg: string) => errors.push(`${iso2}: ${msg}`);

const loc = ([en, es]: L) => ({ en, es });
const pair = (v: string | L): L => (typeof v === 'string' ? [v, v] : v);
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// "Three vertical…" → "three vertical…", "A white cross…" → "a white cross…"; leaves acronyms alone.
const lowerFirst = (s: string) => (/^[A-Z]([a-z]| )/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function cldrName(kind: 'region' | 'language' | 'currency', code: string, iso2: string): L {
  const en = cldr[kind].en.of(code);
  const es = cldr[kind].es.of(code);
  if (!en || !es) {
    fail(iso2, `CLDR has no ${kind} name for "${code}"; give an explicit [en, es]`);
    return [code, code];
  }
  return [en, capFirst(es)];
}

function capitalCoord(iso2: string, src: CountrySource, en: string): [number, number] {
  if (src.capitalCoord) return [src.capitalCoord[0], src.capitalCoord[1]];
  const key = (s: string) => fold(s).replace(/^st\.?\s/, 'saint ').replace(/[^a-z]/g, '');
  const hit = ne.capitals[iso2]?.find((c) => key(c.name) === key(en) || key(en).startsWith(key(c.name)));
  if (!hit) {
    fail(iso2, `no Natural Earth capital point named "${en}" (have: ${ne.capitals[iso2]?.map((c) => c.name).join(', ') ?? 'none'})`);
    return [0, 0];
  }
  return hit.coord;
}

/** Words that must not appear in a clue for this country. */
function forbiddenTerms(name: L): string[] {
  const generic = new Set(['republic', 'republica', 'the', 'of', 'de', 'del', 'la', 'el', 'and', 'y', 'islands', 'islas', 'saint', 'san', 'santa', 'and', 'united', 'unidos', 'unido', 'democratic', 'democratica', 'people', 'kingdom', 'reino', 'federated', 'states', 'estados', 'north', 'south', 'sur', 'norte', 'central', 'new', 'nueva', 'city', 'ciudad', 'guinea', 'island', 'isla', 'arab', 'arabes', 'sao', 'principe', 'leone', 'verde', 'rica', 'marino', 'lucia', 'vincent', 'vicente', 'kitts', 'nevis', 'grenadines', 'granadinas', 'tome', 'emirates', 'emiratos', 'african', 'africana', 'herzegovina', 'tobago', 'barbuda', 'faso', 'sudan', 'korea', 'corea', 'macedonia', 'samoa', 'timor', 'zealand', 'zelanda', 'marshall', 'solomon', 'salomon', 'sri']);
  const words = [...name[0].split(/[\s,()'’-]+/), ...name[1].split(/[\s,()'’-]+/)].map(fold).filter((w) => w.length > 3 && !generic.has(w));
  return [...new Set([fold(name[0]), fold(name[1]), ...words])];
}

function checkClue(iso2: string, skill: string, [en, es]: L, banned: string[]) {
  for (const term of banned) {
    if (fold(en).includes(term) || fold(es).includes(term)) fail(iso2, `${skill} clue gives away the country ("${term}")`);
  }
  if (skill !== 'flag' && !en.startsWith('The thief')) fail(iso2, `${skill} clue (en) must start with "The thief"`);
  if (/\b(el ladr[oó]n|la ladrona|ladr[oó]n|ladrona)\b/i.test(es)) fail(iso2, `${skill} clue (es) must not use a gendered noun for the thief`);
  if (en.length > 160 || es.length > 180) fail(iso2, `${skill} clue is too long for young readers`);
}

const countries: Country[] = [];
for (const [region, entries] of Object.entries(REGIONS)) {
  for (const [iso2, src] of Object.entries(entries)) {
    const geo = ne.countries[iso2];
    if (!geo) { fail(iso2, 'missing from Natural Earth'); continue; }
    if (geo.region !== region) fail(iso2, `listed under ${region} but Natural Earth says ${geo.region}`);

    const name = src.name ?? cldrName('region', iso2, iso2);
    const [capEn, capEs] = pair(src.capital);
    const banned = forbiddenTerms(name);

    const authored = Object.entries(src.clues) as [AuthoredSkill, L][];
    if (authored.length !== 4) fail(iso2, `needs exactly 4 authored clues, has ${authored.length}`);

    const flagClue: L = [`The thief sketched a flag: ${lowerFirst(src.flag[0])}`, `Dibujó una bandera: ${lowerFirst(src.flag[1])}`];
    const clues: Clue[] = [['flag', flagClue] as const, ...authored].map(([skill, text]) => {
      checkClue(iso2, skill, text, banned);
      return {
        id: `${iso2}-${skill}-1`,
        skill,
        difficulty: src.difficulty?.[skill] ?? DEFAULT_DIFFICULTY[skill],
        text: loc(text),
        standardIds: SKILL_STANDARDS[skill],
      };
    });

    const greeting = src.greeting;
    const candidate = {
      iso2,
      iso3: geo.iso3,
      name: loc(name),
      capital: {
        name: loc([capEn, capEs]),
        coord: capitalCoord(iso2, src, capEn),
        ...(src.capitalAlternates ? { alternates: src.capitalAlternates.map((a) => loc(pair(a))) } : {}),
        ...(src.capitalNote ? { note: loc(src.capitalNote) } : {}),
      },
      region,
      subregion: geo.subregion,
      center: geo.label,
      flag: { path: `flags/${iso2.toLowerCase()}.svg`, alt: { en: `Flag of ${name[0]}: ${lowerFirst(src.flag[0])}`, es: `Bandera de ${name[1]}: ${lowerFirst(src.flag[1])}` } },
      languages: src.languages.map((l) => loc(typeof l === 'string' ? cldrName('language', l, iso2) : l)),
      currency: { code: src.currency, name: loc(src.currencyName ?? cldrName('currency', src.currency, iso2)) },
      greeting: { text: greeting[0], ttsLang: greeting[1], meaning: loc(greeting[2] ?? ['Hello', 'Hola']) },
      facts: src.facts.map(loc),
      clues,
    };
    const parsed = Country.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fail(iso2, `${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    countries.push(parsed.data);
  }
}

const codes = countries.map((c) => c.iso2);
if (new Set(codes).size !== codes.length) errors.push('duplicate country codes');
if (errors.length === 0 && countries.length !== 195) errors.push(`expected 195 countries, built ${countries.length}`);

if (errors.length) {
  console.error(`✖ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✔ ${countries.length} countries, ${countries.length * 5} clues validated`);
if (checkOnly) process.exit(0);

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
countries.sort((a, b) => a.iso2.localeCompare(b.iso2));
mkdirSync(join(root, 'content/countries/dist'), { recursive: true });
writeFileSync(join(root, 'content/countries/dist/countries.json'), JSON.stringify(countries, null, 1) + '\n');

const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
const rows = [['iso2', 'country', 'type', 'skill', 'difficulty', 'english', 'spanish'].map(csv).join(',')];
for (const c of countries) {
  for (const k of c.clues) rows.push([c.iso2, c.name.en, 'clue', k.skill, k.difficulty, k.text.en, k.text.es].map(csv).join(','));
  for (const f of c.facts) rows.push([c.iso2, c.name.en, 'fact', '', '', f.en, f.es].map(csv).join(','));
}
writeFileSync(join(root, 'content/countries/dist/review.csv'), rows.join('\n') + '\n');

mkdirSync(join(root, 'content/flags'), { recursive: true });
for (const c of countries) {
  const file = `${c.iso2.toLowerCase()}.svg`;
  copyFileSync(join(root, 'node_modules/flag-icons/flags/4x3', file), join(root, 'content/flags', file));
}

writeFileSync(join(root, 'src/content/flagAssets.ts'), [
  '// GENERATED by scripts/build-countries.ts. Do not edit by hand.',
  '/* eslint-disable @typescript-eslint/no-require-imports */',
  'export const FLAG_ASSETS: Record<string, number> = {',
  ...countries.map((c) => `  ${c.iso2}: require('../../content/flags/${c.iso2.toLowerCase()}.svg'),`),
  '};',
  '',
].join('\n'));

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sql: string[] = [
  '-- GENERATED by scripts/build-countries.ts. Do not edit by hand.',
  '-- Seeds the standards catalogue, version 1 of all 195 country documents, and continent region packs.',
  'begin;',
  '',
  'insert into public.standards (id, framework, code, grade_bands, description_en, description_es) values',
  NGS_STANDARDS.map((s) => `  (${q(s.id)}, 'NGS', ${q(s.code)}, '{K-2,3-5,6-8}', ${q(s.en)}, ${q(s.es)})`).join(',\n'),
  'on conflict (id) do nothing;',
  '',
  'insert into public.content_items (id, version, kind, status, grade_bands, standard_ids, country_codes, data) values',
  countries
    .map((c) => {
      const stds = [...new Set(c.clues.flatMap((k) => k.standardIds))].sort();
      return `  (${q(`country:${c.iso2}`)}, 1, 'country', 'published', '{K-2,3-5,6-8}', '{${stds.join(',')}}', '{${c.iso2}}', ${q(JSON.stringify(c))}::jsonb)`;
    })
    .join(',\n'),
  'on conflict (id, version) do nothing;',
  '',
  '-- One content pack per inhabited continent (tiles come later; see migration 0007).',
  'insert into public.region_packs (id, version, status, name_en, name_es, bbox, min_zoom, max_zoom, manifest, content_bytes) values',
  CONTINENTS.filter((ct) => ct.hasCountries)
    .map((ct) => {
      const members = countries.filter((c) => continentOf(c.region, c.subregion) === ct.id);
      const manifest = members.map((c) => ({ id: `country:${c.iso2}`, version: 1 }));
      const bytes = members.reduce((n, c) => n + Buffer.byteLength(JSON.stringify(c)), 0);
      return `  (${q(ct.id)}, 1, 'published', ${q(ct.name.en)}, ${q(ct.name.es)}, '{${ct.bounds.join(',')}}', 2, 8, ${q(JSON.stringify(manifest))}::jsonb, ${bytes})`;
    })
    .join(',\n'),
  'on conflict (id, version) do nothing;',
  '',
  'commit;',
  '',
];
writeFileSync(join(root, 'supabase/seed.sql'), sql.join('\n'));
console.log('✔ wrote content/countries/dist/{countries.json,review.csv}, content/flags/*.svg, supabase/seed.sql');
