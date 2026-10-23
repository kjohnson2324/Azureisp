// Measuring between two points: what a tap or a search result becomes.
import placesGeo from '../../../assets/map/places.geo.json';
import type { LngLat } from './distance';
import type { PlaceProps } from './model';
import { pick, searchKey, type CountryRepository, type Locale } from '@/content/countries';
import type { Localized } from '@/content/schemas';

export type MeasurePoint =
  | { kind: 'place'; id: string; iso2: string; name: Localized; coord: LngLat }
  | { kind: 'spot'; iso2?: string; coord: LngLat };

type PlaceFeature = { properties: PlaceProps; geometry: { coordinates: number[] } };
const PLACES = (placesGeo.features as unknown as PlaceFeature[]).map((f) => ({
  ...f.properties,
  coord: [f.geometry.coordinates[0]!, f.geometry.coordinates[1]!] as LngLat,
}));
const byId = new Map(PLACES.map((p) => [p.id, p]));

export function placePoint(id: string): MeasurePoint | undefined {
  const p = byId.get(id);
  return p && { kind: 'place', id: p.id, iso2: p.iso2, name: { en: p.name_en, es: p.name_es }, coord: p.coord };
}

/** A tap in measure mode: snap to a capital/city under the finger, else the exact spot. */
export function measurePointFromTap(features: readonly { properties?: object | null }[], lngLat: LngLat): MeasurePoint {
  const props = features.map((f) => (f.properties ?? {}) as Record<string, unknown>);
  const place = props.find((p) => typeof p.id === 'string' && byId.has(p.id as string));
  if (place) return placePoint(place.id as string)!;
  const country = props.find((p) => p.playable === 1 && typeof p.iso2 === 'string');
  return { kind: 'spot', iso2: country?.iso2 as string | undefined, coord: lngLat };
}

/** Name for a point; spots need the country name and a translated template. */
export function pointLabel(
  point: MeasurePoint,
  locale: Locale,
  repo: CountryRepository,
  t: (key: string, opts?: Record<string, string>) => string,
): string {
  if (point.kind === 'place') return pick(point.name, locale);
  const country = point.iso2 ? repo.get(point.iso2) : undefined;
  return country ? t('measure.spotIn', { country: pick(country.name, locale) }) : t('measure.oceanSpot');
}

/** Search capitals and cities by name in either language (accent-insensitive). Capitals rank first. */
export function searchPlaces(query: string, locale: Locale, repo: CountryRepository, limit = 6) {
  const q = searchKey(query.trim());
  if (!q) return [];
  return PLACES
    .filter((p) => searchKey(p.name_en).includes(q) || searchKey(p.name_es).includes(q))
    .sort((a, b) => Number(!searchKey(locale === 'es' ? a.name_es : a.name_en).startsWith(q)) - Number(!searchKey(locale === 'es' ? b.name_es : b.name_en).startsWith(q)) || a.rank - b.rank)
    .slice(0, limit)
    .map((p) => {
      const country = repo.get(p.iso2);
      return { id: p.id, name: locale === 'es' ? p.name_es : p.name_en, country: country ? pick(country.name, locale) : p.iso2 };
    });
}

/** Points + line for the map. */
export function measureGeoJSON(from: MeasurePoint | undefined, to: MeasurePoint | undefined, line: GeoJSON.Feature | undefined, labels: [string, string]) {
  const points: GeoJSON.Feature[] = [];
  if (from) points.push({ type: 'Feature', properties: { label: labels[0], role: 'from' }, geometry: { type: 'Point', coordinates: from.coord } });
  if (to) points.push({ type: 'Feature', properties: { label: labels[1], role: 'to' }, geometry: { type: 'Point', coordinates: to.coord } });
  return {
    points: { type: 'FeatureCollection', features: points } as GeoJSON.FeatureCollection,
    line: { type: 'FeatureCollection', features: line ? [line] : [] } as GeoJSON.FeatureCollection,
  };
}

/** Camera box around both points; whole world when the path crosses the 180° line. */
export function measureBounds(line: GeoJSON.Feature<GeoJSON.MultiLineString>): [number, number, number, number] | undefined {
  if (line.geometry.coordinates.length > 1) return undefined;
  const pts = line.geometry.coordinates[0]!;
  const lngs = pts.map((p) => p[0]!);
  const lats = pts.map((p) => p[1]!);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
