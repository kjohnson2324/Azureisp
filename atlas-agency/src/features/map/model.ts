// Map interaction logic, kept free of native modules so it can be unit-tested
// and shared by the map and the screen-reader-friendly list view.
import { CONTINENTS, SUBREGIONS, continentOf, type ContinentId } from './continents';
import { LAYER, TIER } from './style';
import { pick, searchKey, type CountryRepository, type Locale } from '@/content/countries';
import type { Country } from '@/content/schemas';

export interface PlaceProps {
  id: string;
  kind: 'capital' | 'seat' | 'city';
  iso2: string;
  name_en: string;
  name_es: string;
  rank: number;
}

export type Selection =
  | { kind: 'country'; iso2: string }
  | { kind: 'place'; place: PlaceProps };

export type TapResult =
  | { action: 'zoomToContinent'; continent: ContinentId }
  | { action: 'select'; selection: Selection }
  | { action: 'none' };

interface TappedFeature {
  properties?: object | null;
  layer?: { id?: string };
  // MapLibre Native returns the source layer id on some platforms; we only rely on properties.
}

/**
 * Decide what a tap means. `features` are rendered features under the finger,
 * queried from TAPPABLE_LAYERS (places first, then country fills).
 */
export function resolveTap(features: readonly TappedFeature[], zoom: number): TapResult {
  const props = features.map((f) => (f.properties ?? {}) as Record<string, unknown>);
  const country = props.find((p) => p.playable === 1 && typeof p.iso2 === 'string');

  if (zoom < TIER.countries) {
    const continent = props.find((p) => typeof p.continent === 'string')?.continent as ContinentId | undefined;
    return continent && CONTINENTS.some((c) => c.id === continent) ? { action: 'zoomToContinent', continent } : { action: 'none' };
  }

  const place = props.find((p) => typeof p.kind === 'string' && typeof p.id === 'string' && typeof p.iso2 === 'string');
  if (place && zoom >= TIER.capitals) return { action: 'select', selection: { kind: 'place', place: place as unknown as PlaceProps } };
  if (country) return { action: 'select', selection: { kind: 'country', iso2: country.iso2 as string } };
  return { action: 'none' };
}

/** Which layers to query for a tap at this zoom. */
export const layersForTap = (zoom: number) =>
  zoom < TIER.capitals ? [LAYER.fill] : zoom < TIER.cities ? [LAYER.capitals, LAYER.fill] : [LAYER.capitals, LAYER.cities, LAYER.fill];

// ---------------------------------------------------------------------------
// Place card view model
// ---------------------------------------------------------------------------
export interface PlaceCard {
  iso2: string;
  title: string;
  /** e.g. "Capital of Kenya" or "Africa · Eastern Africa" */
  subtitle: string;
  kind: 'country' | 'capital' | 'seat' | 'city';
  flagPath: string;
  flagAlt: string;
  capital: string;
  capitalNote?: string;
  languages: string;
  currency: string;
  facts: string[];
  greeting: { text: string; ttsLang: string; meaning: string };
  photo?: { path: string; alt: string; credit: string };
}

const STRINGS = {
  en: { capitalOf: 'Capital of', cityIn: 'City in', seatOf: 'Also a capital city of' },
  es: { capitalOf: 'Capital de', cityIn: 'Ciudad de', seatOf: 'También es ciudad capital de' },
} as const;

export function buildPlaceCard(selection: Selection, repo: CountryRepository, locale: Locale): PlaceCard | undefined {
  const iso2 = selection.kind === 'country' ? selection.iso2 : selection.place.iso2;
  const c = repo.get(iso2);
  if (!c) return undefined;
  const name = pick(c.name, locale);
  const t = STRINGS[locale];
  const continent = CONTINENTS.find((x) => x.id === continentOf(c.region, c.subregion));

  let title = name;
  const continentName = continent ? pick(continent.name, locale) : c.region;
  const subregion = SUBREGIONS[c.subregion] ? pick(SUBREGIONS[c.subregion]!, locale) : c.subregion;
  let subtitle = searchKey(subregion) === searchKey(continentName) || continent?.id === 'south-america'
    ? continentName
    : `${continentName} · ${subregion}`;
  let kind: PlaceCard['kind'] = 'country';
  if (selection.kind === 'place') {
    const p = selection.place;
    title = locale === 'es' ? p.name_es : p.name_en;
    kind = p.kind;
    subtitle = p.kind === 'capital' ? `${t.capitalOf} ${name}` : p.kind === 'seat' ? `${t.seatOf} ${name}` : `${t.cityIn} ${name}`;
  }

  return {
    iso2,
    title,
    subtitle,
    kind,
    flagPath: c.flag.path,
    flagAlt: pick(c.flag.alt, locale),
    capital: pick(c.capital.name, locale),
    capitalNote: c.capital.note ? pick(c.capital.note, locale) : undefined,
    languages: c.languages.map((l) => pick(l, locale)).join(', '),
    currency: `${pick(c.currency.name, locale)} (${c.currency.code})`,
    facts: c.facts.map((f) => pick(f, locale)),
    greeting: { text: c.greeting.text, ttsLang: c.greeting.ttsLang, meaning: pick(c.greeting.meaning, locale) },
    photo: c.photo ? { path: c.photo.path, alt: pick(c.photo.alt, locale), credit: c.photo.credit } : undefined,
  };
}

/** Everything read aloud for a card, in reading order. */
export function cardSpeech(card: PlaceCard, locale: Locale): string[] {
  const label = locale === 'es'
    ? { capital: 'Capital', languages: 'Idiomas', currency: 'Moneda' }
    : { capital: 'Capital', languages: 'Languages', currency: 'Currency' };
  return [
    `${card.title}. ${card.subtitle}.`,
    card.kind === 'country' ? `${label.capital}: ${card.capital}.` : '',
    `${label.languages}: ${card.languages}.`,
    `${label.currency}: ${card.currency}.`,
    ...card.facts,
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------
// List view (screen-reader alternative to the map)
// ---------------------------------------------------------------------------
export interface ListSection {
  continent: ContinentId;
  title: string;
  countries: { iso2: string; name: string; capital: string }[];
}

export function buildListSections(countries: readonly Country[], locale: Locale, query = ''): ListSection[] {
  const q = searchKey(query.trim());
  const matches = (c: Country) =>
    !q || [c.name.en, c.name.es, c.capital.name.en, c.capital.name.es].some((s) => searchKey(s).includes(q));
  const collator = new Intl.Collator(locale);
  return CONTINENTS.filter((ct) => ct.hasCountries).map((ct) => ({
    continent: ct.id,
    title: pick(ct.name, locale),
    countries: countries
      .filter((c) => continentOf(c.region, c.subregion) === ct.id && matches(c))
      .map((c) => ({ iso2: c.iso2, name: pick(c.name, locale), capital: pick(c.capital.name, locale) }))
      .sort((a, b) => collator.compare(a.name, b.name)),
  })).filter((s) => s.countries.length > 0);
}

/** Camera target for a country: its label point at country-tier zoom. */
export function countryCamera(c: Country) {
  return { center: c.center, zoom: Math.max(TIER.capitals, 4.5) };
}
