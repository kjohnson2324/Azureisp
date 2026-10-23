import countriesGeo from '../../../../assets/map/countries.geo.json';
import labelsGeo from '../../../../assets/map/labels.geo.json';
import placesGeo from '../../../../assets/map/places.geo.json';
import { pickVoice } from '@/a11y/speech';
import { CountryRepository } from '@/content/countries';
import { buildListSections, buildPlaceCard, cardSpeech, layersForTap, resolveTap, type PlaceProps } from '../model';
import { buildMapStyle, LAYER, TIER } from '../style';
import { SUBREGIONS } from '../continents';

const repo = new CountryRepository();
const place = (id: string) => placesGeo.features.find((f) => f.properties.id === id)!.properties as PlaceProps;
const kenyaFill = { properties: { iso2: 'KE', continent: 'africa', playable: 1 } };

describe('bundled map data', () => {
  it('has one playable shape for each of the 195 countries', () => {
    const playable = countriesGeo.features.filter((f) => f.properties.playable === 1).map((f) => f.properties.iso2);
    expect(new Set(playable).size).toBe(195);
    expect(playable).toHaveLength(195);
  });

  it('has a capital point and a label point for every country', () => {
    const capitals = placesGeo.features.filter((f) => f.properties.kind === 'capital');
    expect(capitals).toHaveLength(195);
    expect(labelsGeo.features).toHaveLength(195);
  });

  it('includes capital-role cities such as La Paz and Cape Town', () => {
    const seats = placesGeo.features.filter((f) => f.properties.kind === 'seat').map((f) => f.properties.name_en);
    expect(seats).toEqual(expect.arrayContaining(['La Paz', 'Cape Town', 'The Hague']));
  });

  it('leaves non-playable land unlabeled', () => {
    for (const f of countriesGeo.features.filter((x) => x.properties.playable === 0)) {
      expect(f.properties).not.toHaveProperty('name_en');
    }
  });
});

describe('resolveTap', () => {
  it('zooms to the continent at world zoom', () => {
    expect(resolveTap([kenyaFill], 1)).toEqual({ action: 'zoomToContinent', continent: 'africa' });
  });

  it('lets players tap Antarctica even though it has no countries', () => {
    expect(resolveTap([{ properties: { continent: 'antarctica', playable: 0 } }], 1)).toEqual({ action: 'zoomToContinent', continent: 'antarctica' });
  });

  it('selects the country at country zoom', () => {
    expect(resolveTap([kenyaFill], 3)).toEqual({ action: 'select', selection: { kind: 'country', iso2: 'KE' } });
  });

  it('prefers a capital over the country underneath once places show', () => {
    const nairobi = { properties: place('capital:KE') };
    expect(resolveTap([nairobi, kenyaFill], 5)).toEqual({ action: 'select', selection: { kind: 'place', place: place('capital:KE') } });
  });

  it('ignores taps on the ocean and on non-playable land', () => {
    expect(resolveTap([], 3)).toEqual({ action: 'none' });
    expect(resolveTap([{ properties: { playable: 0 } }], 3)).toEqual({ action: 'none' });
  });

  it('only queries layers that are visible at the current zoom', () => {
    expect(layersForTap(1)).toEqual([LAYER.fill]);
    expect(layersForTap(TIER.capitals)).toEqual([LAYER.capitals, LAYER.fill]);
    expect(layersForTap(6)).toEqual([LAYER.capitals, LAYER.cities, LAYER.fill]);
  });
});

describe('place cards', () => {
  it('splits the Americas the way U.S. classrooms do', () => {
    const where = (iso2: string) => buildListSections(repo.all(), 'en').find((s) => s.countries.some((c) => c.iso2 === iso2))!.continent;
    expect(where('MX')).toBe('north-america');
    expect(where('PA')).toBe('north-america');
    expect(where('CU')).toBe('north-america');
    expect(where('CO')).toBe('south-america');
  });

  it('builds a bilingual country card', () => {
    const en = buildPlaceCard({ kind: 'country', iso2: 'KE' }, repo, 'en')!;
    expect(en.title).toBe('Kenya');
    expect(en.subtitle).toBe('Africa · Eastern Africa');
    expect(en.greeting).toEqual({ text: 'Jambo', ttsLang: 'sw-KE', meaning: 'Hello' });
    expect(en.flagAlt).toMatch(/^Flag of Kenya:/);
    const es = buildPlaceCard({ kind: 'country', iso2: 'KE' }, repo, 'es')!;
    expect(es.title).toBe('Kenia');
    expect(es.subtitle).toBe('África · África oriental');
  });

  it('labels capitals, capital-role cities and cities', () => {
    expect(buildPlaceCard({ kind: 'place', place: place('capital:BO') }, repo, 'en')!.subtitle).toBe('Capital of Bolivia');
    const laPaz = placesGeo.features.find((f) => f.properties.name_en === 'La Paz')!.properties as PlaceProps;
    expect(buildPlaceCard({ kind: 'place', place: laPaz }, repo, 'es')!.subtitle).toBe('También es ciudad capital de Bolivia');
    const city = placesGeo.features.find((f) => f.properties.kind === 'city' && f.properties.iso2 === 'BR')!.properties as PlaceProps;
    expect(buildPlaceCard({ kind: 'place', place: city }, repo, 'en')!.subtitle).toBe('City in Brazil');
  });

  it('has a Spanish subregion name for every country', () => {
    for (const c of repo.all()) expect(SUBREGIONS[c.subregion]).toBeDefined();
  });

  it('shows the note for shared or disputed capitals', () => {
    expect(buildPlaceCard({ kind: 'country', iso2: 'ZA' }, repo, 'en')!.capitalNote).toMatch(/three capitals/);
  });

  it('reads the whole card aloud in order', () => {
    const lines = cardSpeech(buildPlaceCard({ kind: 'country', iso2: 'JP' }, repo, 'en')!, 'en');
    expect(lines[0]).toBe('Japan. Asia · Eastern Asia.');
    expect(buildPlaceCard({ kind: 'country', iso2: 'BR' }, repo, 'en')!.subtitle).toBe('South America');
    expect(lines).toContain('Capital: Tokyo.');
    expect(lines.length).toBe(6);
  });
});

describe('list view', () => {
  it('groups all 195 countries into the six inhabited continents', () => {
    const sections = buildListSections(repo.all(), 'en');
    expect(sections.map((s) => s.continent)).toEqual(['africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america']);
    expect(sections.reduce((n, s) => n + s.countries.length, 0)).toBe(195);
  });

  it('searches names and capitals ignoring accents, in either language', () => {
    expect(buildListSections(repo.all(), 'es', 'japon')[0]!.countries.map((c) => c.iso2)).toEqual(['JP']);
    expect(buildListSections(repo.all(), 'en', 'bogota')[0]!.countries.map((c) => c.iso2)).toEqual(['CO']);
  });

  it('sorts with the locale collator', () => {
    const europe = buildListSections(repo.all(), 'es').find((s) => s.continent === 'europe')!;
    const names = europe.countries.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('es').compare));
  });
});

describe('content updates', () => {
  it('applies only newer, valid versions', () => {
    const r = new CountryRepository();
    const jp = r.get('JP')!;
    const updated = { ...jp, facts: [...jp.facts, { en: 'New fact.', es: 'Dato nuevo.' }] };
    expect(r.apply([{ version: 1, data: updated }])).toBe(0);
    expect(r.apply([{ version: 2, data: { ...updated, clues: [] } as never }])).toBe(0);
    expect(r.apply([{ version: 2, data: updated }])).toBe(1);
    expect(r.get('JP')!.facts).toHaveLength(3);
  });
});

describe('map style', () => {
  const style = (o: Partial<Parameters<typeof buildMapStyle>[0]> = {}) =>
    buildMapStyle({ locale: 'en', glyphsBase: 'file:///glyphs', countries: countriesGeo as never, places: placesGeo as never, countryLabels: labelsGeo as never, ...o });

  it('uses only bundled sources (no remote tiles)', () => {
    for (const src of Object.values(style().sources)) expect(src.type).toBe('geojson');
    expect(style().glyphs).toBe('file:///glyphs/{fontstack}/{range}.pbf');
  });

  it('switches label language', () => {
    const labels = (s: ReturnType<typeof style>) => s.layers.find((l) => l.id === LAYER.countryLabels) as { layout: Record<string, unknown> };
    expect(labels(style()).layout['text-field']).toEqual(['get', 'name_en']);
    expect(labels(style({ locale: 'es' })).layout['text-field']).toEqual(['get', 'name_es']);
  });

  it('drops colour fills and thickens borders in high-contrast mode', () => {
    const fill = style({ highContrast: true }).layers.find((l) => l.id === LAYER.fill) as { paint: Record<string, unknown> };
    expect(fill.paint['fill-color']).toBe('#FFFFFF');
  });

  it('never filters on zoom (filters only see whole-number zooms); uses minzoom instead', () => {
    const layers = style().layers as { id: string; minzoom?: number; filter?: unknown }[];
    for (const l of layers) expect(JSON.stringify(l.filter ?? null)).not.toContain('zoom');
    expect(layers.find((l) => l.id === LAYER.cityLabels)!.minzoom).toBe(TIER.cities);
    expect(layers.find((l) => l.id === LAYER.cities)!.minzoom).toBe(TIER.cities);
  });

  it('scales label text with the text-size preference', () => {
    const c = style({ textScale: 2 }).layers.find((l) => l.id === LAYER.continentLabels) as { layout: Record<string, unknown> };
    expect(c.layout['text-size']).toBe(36);
  });
});

describe('pickVoice', () => {
  const voices = [{ language: 'en-US', identifier: 'a' }, { language: 'sw_TZ', identifier: 'b' }, { language: 'es-MX', identifier: 'c' }];
  it('prefers exact, then same-language voices', () => {
    expect(pickVoice(voices, 'es-MX')?.identifier).toBe('c');
    expect(pickVoice(voices, 'sw-KE')?.identifier).toBe('b');
    expect(pickVoice(voices, 'ja-JP')).toBeUndefined();
  });
});
