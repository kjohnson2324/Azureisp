/// <reference types="node" />
// Builds the offline world map that ships inside the app (no tile server needed).
//
//   npx tsx scripts/build-map-data.ts <natural-earth-dir>
//
// <natural-earth-dir> must contain (from github.com/nvkelso/natural-earth-vector/geojson):
//   ne_50m_admin_0_countries.geojson, ne_10m_populated_places.geojson
// Inputs also: content/countries/dist/countries.json (run content:build first)
// Outputs:
//   assets/map/countries.geo.json   simplified country polygons (playable = one of our 195)
//   assets/map/places.geo.json      capitals, other capital-role cities, and major cities
//   assets/map/labels.geo.json      one label point per country, ranked by area (big countries win)
//   assets/map/glyphs/<font>/<range>.pbf   Noto Sans glyphs for exactly the characters used
//   src/features/map/glyphAssets.ts GENERATED static requires for Metro

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONTINENTS, continentOf } from '../src/features/map/continents';
import { GLYPH_FONTS } from '../src/features/map/style';
import type { Country } from '../src/content/schemas';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const neDir = process.argv[2];
if (!neDir) throw new Error('usage: build-map-data.ts <natural-earth-dir>');

const countries: Country[] = JSON.parse(readFileSync(join(root, 'content/countries/dist/countries.json'), 'utf8'));
const byIso = new Map(countries.map((c) => [c.iso2, c]));
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');
const round = (n: number) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// 1. Country polygons
// ---------------------------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'atlas-map-'));
const simplified = join(tmp, 'countries.json');
execFileSync(join(root, 'node_modules/.bin/mapshaper'), [
  '-i', join(neDir, 'ne_50m_admin_0_countries.geojson'),
  '-filter-fields', 'ISO_A2_EH,ISO_A2,TYPE',
  '-simplify', '12%', 'weighted', 'keep-shapes',
  '-o', simplified, 'format=geojson', 'precision=0.01',
], { stdio: 'inherit' });

type Feature = { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown };
const raw: { features: Feature[] } = JSON.parse(readFileSync(simplified, 'utf8'));
const NOT_PLAYABLE_TYPES = new Set(['Dependency', 'Lease']);
const claimed = new Set<string>();
const countryFeatures: Feature[] = [];
for (const f of raw.features) {
  const p = f.properties as { ISO_A2_EH?: string; ISO_A2?: string; TYPE?: string };
  const iso2 = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2;
  const c = iso2 ? byIso.get(iso2) : undefined;
  // One playable shape per country; dependencies (e.g. Australia's Indian Ocean
  // territories) and places outside our 195 are drawn as neutral, unlabeled land.
  const playable = !!c && !claimed.has(c.iso2) && !NOT_PLAYABLE_TYPES.has(p.TYPE ?? '');
  if (playable) claimed.add(c.iso2);
  countryFeatures.push({
    type: 'Feature',
    properties: playable
      ? { iso2: c.iso2, continent: continentOf(c.region, c.subregion), name_en: c.name.en, name_es: c.name.es, playable: 1 }
      : iso2 === 'AQ' ? { continent: 'antarctica', playable: 0 } : { playable: 0 },
    geometry: f.geometry,
  });
}
// Rough polygon area (square degrees, latitude-corrected) to rank country labels.
const ringArea = (ring: number[][]) => {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j]![0]! - ring[i]![0]!) * (ring[j]![1]! + ring[i]![1]!) * Math.cos((ring[i]![1]! * Math.PI) / 180);
  }
  return Math.abs(a / 2);
};
const areaOf = (g: any): number =>
  g.type === 'Polygon' ? ringArea(g.coordinates[0]) : g.coordinates.reduce((t: number, poly: number[][][]) => t + ringArea(poly[0]!), 0);
const areas = new Map(countryFeatures.filter((f) => f.properties.playable).map((f) => [f.properties.iso2 as string, areaOf(f.geometry)]));
const byArea = [...areas.entries()].sort((a, b) => b[1] - a[1]).map(([iso2]) => iso2);
const labelFeatures: Feature[] = countries.map((c) => ({
  type: 'Feature',
  properties: { iso2: c.iso2, name_en: c.name.en, name_es: c.name.es, rank: byArea.indexOf(c.iso2) },
  geometry: { type: 'Point', coordinates: c.center },
}));

const missing = countries.filter((c) => !claimed.has(c.iso2)).map((c) => c.iso2);
if (missing.length) throw new Error(`no playable polygon for: ${missing.join(', ')}`);

// ---------------------------------------------------------------------------
// 2. Places: capitals (from our content), capital-role alternates, major cities
// ---------------------------------------------------------------------------
type Place = { id: string; kind: 'capital' | 'seat' | 'city'; iso2: string; name_en: string; name_es: string; rank: number; coord: [number, number] };
const places: Place[] = countries.map((c) => ({
  id: `capital:${c.iso2}`, kind: 'capital', iso2: c.iso2, name_en: c.capital.name.en, name_es: c.capital.name.es, rank: 0, coord: c.capital.coord,
}));

const pp: { features: { properties: Record<string, any>; geometry: { coordinates: [number, number] } }[] } =
  JSON.parse(readFileSync(join(neDir, 'ne_10m_populated_places.geojson'), 'utf8'));
const MAX_CITIES = 4;
const perCountry = new Map<string, number>();
const candidates = pp.features
  .filter((f) => byIso.has(f.properties.ISO_A2))
  .sort((a, b) => (a.properties.SCALERANK - b.properties.SCALERANK) || (b.properties.POP_MAX - a.properties.POP_MAX));
for (const f of candidates) {
  const p = f.properties;
  const c = byIso.get(p.ISO_A2)!;
  const name_en: string = p.NAME_EN || p.NAME;
  const name_es: string = p.NAME_ES || name_en;
  const key = fold(name_en);
  if (fold(c.capital.name.en) === key || places.some((x) => x.iso2 === c.iso2 && fold(x.name_en) === key)) continue;
  const isSeat = (c.capital.alternates ?? []).some((a) => fold(a.en) === key);
  const n = perCountry.get(c.iso2) ?? 0;
  // Keep cities that are major on a world map, or the largest city of a country whose
  // capital is not its largest. Capital-role alternates (La Paz, Cape Town...) always stay.
  const major = p.SCALERANK <= 3 || (n === 0 && p.POP_MAX >= 500_000);
  if (!isSeat && (!major || n >= MAX_CITIES)) continue;
  perCountry.set(c.iso2, n + 1);
  places.push({
    id: `city:${c.iso2}:${key}`,
    kind: isSeat ? 'seat' : 'city',
    iso2: c.iso2,
    name_en,
    name_es,
    rank: isSeat ? 1 : 2 + p.SCALERANK,
    coord: [round(f.geometry.coordinates[0]), round(f.geometry.coordinates[1])],
  });
}
const missingSeats = countries.flatMap((c) =>
  (c.capital.alternates ?? []).filter((a) => !places.some((p) => p.iso2 === c.iso2 && fold(p.name_en) === fold(a.en))).map((a) => `${c.iso2}:${a.en}`));
if (missingSeats.length) console.warn(`! capital alternates with no Natural Earth point: ${missingSeats.join(', ')}`);

const asPoint = ({ coord, ...props }: Place): Feature => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coord } });

mkdirSync(join(root, 'assets/map'), { recursive: true });
writeFileSync(join(root, 'assets/map/countries.geo.json'), JSON.stringify({ type: 'FeatureCollection', features: countryFeatures }));
writeFileSync(join(root, 'assets/map/labels.geo.json'), JSON.stringify({ type: 'FeatureCollection', features: labelFeatures }));
writeFileSync(join(root, 'assets/map/places.geo.json'), JSON.stringify({ type: 'FeatureCollection', features: places.map(asPoint) }));
rmSync(tmp, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 3. Glyphs for every character a label can show (Noto Sans, SIL OFL)
// ---------------------------------------------------------------------------
const labels = [
  ...countries.flatMap((c) => [c.name.en, c.name.es]),
  ...places.flatMap((p) => [p.name_en, p.name_es]),
  ...CONTINENTS.flatMap((c) => [c.name.en, c.name.es]),
  '0123456789 .,-()\'’',
];
const ranges = new Set<number>();
for (const s of labels) for (const ch of s) ranges.add(Math.floor(ch.codePointAt(0)! / 256) * 256);
const rangeNames = [...ranges].sort((a, b) => a - b).map((r) => `${r}-${r + 255}`);

const SOURCE: Record<string, string> = { 'NotoSans-Regular': 'Noto Sans Regular', 'NotoSans-Medium': 'Noto Sans Medium' };
for (const font of GLYPH_FONTS) {
  const dir = join(root, 'assets/map/glyphs', font);
  mkdirSync(dir, { recursive: true });
  for (const range of rangeNames) {
    const out = join(dir, `${range}.pbf`);
    if (existsSync(out) && statSync(out).size > 0) continue;
    const url = `https://raw.githubusercontent.com/protomaps/basemaps-assets/main/fonts/${encodeURIComponent(SOURCE[font]!)}/${range}.pbf`;
    execFileSync('curl', ['-sSfL', '-o', out, url]);
  }
}
const glyphLines = GLYPH_FONTS.flatMap((font) =>
  rangeNames.map((range) => `  '${font}/${range}': require('../../../assets/map/glyphs/${font}/${range}.pbf'),`));
writeFileSync(join(root, 'src/features/map/glyphAssets.ts'), [
  '// GENERATED by scripts/build-map-data.ts. Do not edit by hand.',
  '// Glyph PBFs bundled with the app so map labels render offline on first launch.',
  '/* eslint-disable @typescript-eslint/no-require-imports */',
  'export const GLYPH_ASSETS: Record<string, number> = {',
  ...glyphLines,
  '};',
  '',
].join('\n'));

const kb = (p: string) => `${Math.round(statSync(join(root, p)).size / 1024)} KB`;
console.log(`✔ ${countryFeatures.length} land shapes (${claimed.size} playable), ${kb('assets/map/countries.geo.json')}`);
console.log(`✔ ${places.length} places (${places.filter((p) => p.kind === 'city').length} cities, ${places.filter((p) => p.kind === 'seat').length} capital-role cities), ${kb('assets/map/places.geo.json')}`);
console.log(`✔ glyph ranges: ${rangeNames.join(', ')}`);
