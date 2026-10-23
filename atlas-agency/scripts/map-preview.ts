/// <reference types="node" />
// Writes a self-contained browser preview of the app's map style (MapLibre GL JS
// renders the same style spec as MapLibre Native).
//
//   npx tsx scripts/map-preview.ts <out-dir> [en|es] [--high-contrast] [--dark] [--measure=capital:MX,capital:ES]
//   python3 -m http.server -d <out-dir> 8765   then open http://localhost:8765/
//
// URL hash selects the view, e.g. #zoom=1.2&center=10,20 or #bounds=-170,-58,180,75
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { greatCircle } from '../src/features/map/distance';
import { measureGeoJSON, placePoint } from '../src/features/map/measure';
import { buildMapStyle, measureLayers } from '../src/features/map/style';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [out, locale = 'en'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!out) throw new Error('usage: map-preview.ts <out-dir> [en|es] [--high-contrast] [--dark]');
const flags = new Set(process.argv.filter((a) => a.startsWith('--')));
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets/map/glyphs'), join(out, 'glyphs'), { recursive: true });
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  cpSync(join(root, 'node_modules/maplibre-gl/dist', f), join(out, f));
}

const style = buildMapStyle({
  locale: locale === 'es' ? 'es' : 'en',
  glyphsBase: 'GLYPHS_BASE',
  countries: read('assets/map/countries.geo.json'),
  places: read('assets/map/places.geo.json'),
  countryLabels: read('assets/map/labels.geo.json'),
  highContrast: flags.has('--high-contrast'),
  dark: flags.has('--dark'),
});
// Optional measurement overlay, drawn with the same layers the app uses.
const measureArg = process.argv.find((a) => a.startsWith('--measure='));
if (measureArg) {
  const [a, b] = measureArg.slice('--measure='.length).split(',').map((id) => placePoint(id)!);
  const name = (p: typeof a) => (p!.kind === 'place' ? p!.name[locale === 'es' ? 'es' : 'en'] : '');
  const geo = measureGeoJSON(a, b, greatCircle(a!.coord, b!.coord), [`A · ${name(a)}`, `B · ${name(b)}`]);
  const layers = measureLayers(flags.has('--dark'));
  style.sources.measureLine = { type: 'geojson', data: geo.line };
  style.sources.measurePoints = { type: 'geojson', data: geo.points };
  style.layers.push(
    { ...layers.casing, source: 'measureLine' } as never,
    { ...layers.line, source: 'measureLine' } as never,
    { ...layers.points, source: 'measurePoints' } as never,
    { ...layers.labels, source: 'measurePoints' } as never,
  );
}
writeFileSync(join(out, 'style.json'), JSON.stringify(style));
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atlas map preview</title><link rel="stylesheet" href="maplibre-gl.css">
<style>html,body,#map{margin:0;height:100%}</style></head>
<body><div id="map"></div><script type="module">
import * as maplibregl from './maplibre-gl.mjs';
const q = new URLSearchParams(location.hash.slice(1));
fetch('style.json').then(r => r.text()).then(t => {
  const style = JSON.parse(t.replaceAll('GLYPHS_BASE', location.origin + '/glyphs'));
  const map = new maplibregl.Map({ container: 'map', style, attributionControl: { compact: false },
    center: (q.get('center') || '10,20').split(',').map(Number), zoom: Number(q.get('zoom') || 1),
    ...(q.get('bounds') ? { bounds: q.get('bounds').split(',').map(Number) } : {}) });
  window.mapErrors = [];
  map.on('error', e => window.mapErrors.push(String(e.error && e.error.message || e)));
  map.on('idle', () => { window.mapIdle = true; });
});
</script></body></html>`);
console.log(`✔ preview written to ${out}`);
