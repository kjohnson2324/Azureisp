// Distances on the globe and kid-friendly comparisons.
//
// Privacy: the "school to home" comparison uses a rough distance the student
// (or a grown-up) picks from a short list. The app never asks for an address,
// never uses GPS, and never sends this value to the server (see
// syncablePreferences in a11y/preferences.ts).

export type LngLat = [number, number];
export type Units = 'imperial' | 'metric';

/** Mean Earth radius (IUGG), km. */
const EARTH_RADIUS_KM = 6371.0088;
export const KM_PER_MILE = 1.609344;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle ("as the crow flies") distance in km. */
export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points along the shortest path over the globe, split where it crosses the
 * 180° line so both halves draw inside the map's bounds.
 */
export function greatCircle(a: LngLat, b: LngLat, steps = 64): GeoJSON.Feature<GeoJSON.MultiLineString> {
  const [l1, p1, l2, p2] = [rad(a[0]), rad(a[1]), rad(b[0]), rad(b[1])];
  const d = distanceKm(a, b) / EARTH_RADIUS_KM;
  const points: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    if (d === 0) { points.push(a); break; }
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    points.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }

  const lines: LngLat[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    if (Math.abs(cur[0] - prev[0]) > 180) {
      // Interpolate the latitude where the path meets ±180°, end this piece there, start the next.
      const edge = prev[0] > 0 ? 180 : -180;
      const curUnwrapped = cur[0] + (prev[0] > 0 ? 360 : -360);
      const t = (edge - prev[0]) / (curUnwrapped - prev[0]);
      const lat = prev[1] + t * (cur[1] - prev[1]);
      lines.at(-1)!.push([edge, lat]);
      lines.push([[-edge, lat]]);
    }
    lines.at(-1)!.push(cur);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } };
}

/** Choices for "how far is school from home?", in the student's units. */
export const SCHOOL_TRIP_CHOICES: Record<Units, readonly number[]> = {
  metric: [0.5, 1, 2, 3, 5, 8, 10, 15, 20],
  imperial: [0.25, 0.5, 1, 2, 3, 5, 10],
};
export const DEFAULT_SCHOOL_TRIP_KM = 2;

export const toUnit = (km: number, units: Units) => (units === 'metric' ? km : km / KM_PER_MILE);
export const fromUnit = (value: number, units: Units) => (units === 'metric' ? value : value * KM_PER_MILE);

/** The choice in `units` closest to a stored km value (so switching units stays sensible). */
export function nearestChoice(km: number, units: Units): number {
  const v = toUnit(km, units);
  return SCHOOL_TRIP_CHOICES[units].reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) ? c : best));
}

/** Readable number: one decimal below 10, whole numbers above, locale separators. */
export function formatNumber(n: number, locale: 'en' | 'es'): string {
  const digits = n < 10 && Math.round(n * 10) % 10 !== 0 ? 1 : 0;
  // es-MX groups thousands from 1,000 (es-ES would print "2815" without a separator).
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function formatDistance(km: number, units: Units, locale: 'en' | 'es') {
  const miles = formatNumber(km / KM_PER_MILE, locale);
  const kms = formatNumber(km, locale);
  const mi = locale === 'es' ? 'millas' : 'miles';
  const primary = units === 'imperial' ? `${miles} ${mi}` : `${kms} km`;
  const secondary = units === 'imperial' ? `${kms} km` : `${miles} ${mi}`;
  return { primary, secondary };
}

export interface TripComparison {
  /** Round trips (school → home → school) that add up to the distance. */
  roundTrips: number;
  kind: 'lessThanOne' | 'once' | 'many';
  count: string;
}

/** "Back and forth" = one round trip = twice the one-way school-to-home distance. */
export function compareToSchoolTrips(km: number, schoolTripKm: number, locale: 'en' | 'es'): TripComparison {
  const roundTrips = km / (2 * schoolTripKm);
  const shown = roundTrips < 10 ? Math.round(roundTrips * 10) / 10 : Math.round(roundTrips);
  if (shown < 1) return { roundTrips, kind: 'lessThanOne', count: formatNumber(shown, locale) };
  if (shown === 1) return { roundTrips, kind: 'once', count: '1' };
  return { roundTrips, kind: 'many', count: formatNumber(shown, locale) };
}
