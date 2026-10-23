import {
  compareToSchoolTrips, distanceKm, formatDistance, formatNumber, fromUnit, greatCircle, KM_PER_MILE, nearestChoice,
} from '../distance';

const LONDON: [number, number] = [-0.1278, 51.5074];
const PARIS: [number, number] = [2.3522, 48.8566];
const NEW_YORK: [number, number] = [-74.006, 40.7128];
const SUVA: [number, number] = [178.4419, -18.1416];
const APIA: [number, number] = [-171.7514, -13.8333];

describe('distanceKm', () => {
  it('matches published great-circle distances', () => {
    expect(distanceKm(LONDON, PARIS)).toBeCloseTo(343.5, 0);
    expect(distanceKm(NEW_YORK, LONDON)).toBeCloseTo(5570, -1);
  });
  it('is symmetric and zero for the same point', () => {
    expect(distanceKm(PARIS, LONDON)).toBeCloseTo(distanceKm(LONDON, PARIS), 9);
    expect(distanceKm(PARIS, PARIS)).toBe(0);
  });
  it('takes the short way across the 180° line', () => {
    expect(distanceKm(SUVA, APIA)).toBeLessThan(1200);
  });
});

describe('greatCircle', () => {
  it('starts and ends at the two points', () => {
    const lines = greatCircle(LONDON, NEW_YORK).geometry.coordinates;
    expect(lines).toHaveLength(1);
    expect(lines[0]![0]![0]).toBeCloseTo(LONDON[0], 6);
    expect(lines[0]!.at(-1)![1]).toBeCloseTo(NEW_YORK[1], 6);
  });
  it('bends toward the pole like a real flight path', () => {
    const mid = greatCircle(LONDON, NEW_YORK).geometry.coordinates[0]![32]!;
    expect(mid[1]).toBeGreaterThan(Math.max(LONDON[1], NEW_YORK[1]));
  });
  it('splits at the 180° line so both halves stay on the map', () => {
    const lines = greatCircle(SUVA, APIA).geometry.coordinates;
    expect(lines).toHaveLength(2);
    expect(lines[0]!.at(-1)![0]).toBe(180);
    expect(lines[1]![0]![0]).toBe(-180);
    for (const line of lines) for (const [lng] of line) expect(Math.abs(lng!)).toBeLessThanOrEqual(180);
  });
  it('handles a zero-length measurement', () => {
    expect(greatCircle(PARIS, PARIS).geometry.coordinates).toEqual([[PARIS]]);
  });
});

describe('formatting', () => {
  it('shows both unit systems, primary first, with locale separators', () => {
    expect(formatDistance(5570, 'imperial', 'en')).toEqual({ primary: '3,461 miles', secondary: '5,570 km' });
    expect(formatDistance(5570, 'metric', 'es')).toEqual({ primary: '5,570 km', secondary: '3,461 millas' });
    expect(formatDistance(3.2, 'metric', 'en').primary).toBe('3.2 km');
  });
  it('rounds small numbers to one decimal, large to whole', () => {
    expect(formatNumber(2.5, 'en')).toBe('2.5');
    expect(formatNumber(2, 'en')).toBe('2');
    expect(formatNumber(2815.4, 'en')).toBe('2,815');
  });
});

describe('school-to-home comparison', () => {
  it('counts round trips (back and forth = twice the one-way distance)', () => {
    // 5,570 km with a 2 km walk to school: 5,570 / 4 = 1,392.5 → about 1,393 round trips.
    expect(compareToSchoolTrips(5570, 2, 'en')).toMatchObject({ kind: 'many', count: '1,393' });
  });
  it('uses one decimal for small counts and handles once / less than once', () => {
    expect(compareToSchoolTrips(10, 2, 'en')).toMatchObject({ kind: 'many', count: '2.5' });
    expect(compareToSchoolTrips(4, 2, 'en')).toMatchObject({ kind: 'once' });
    expect(compareToSchoolTrips(1, 2, 'en')).toMatchObject({ kind: 'lessThanOne' });
  });
  it('snaps a stored distance to the nearest choice when units change', () => {
    expect(nearestChoice(2, 'imperial')).toBe(1);
    expect(nearestChoice(fromUnit(3, 'imperial'), 'imperial')).toBe(3);
    expect(nearestChoice(3 * KM_PER_MILE, 'metric')).toBe(5);
  });
});
