// Map-reading travel clues: which way and how far the thief flew.
import { distanceKm, type LngLat } from '@/features/map/distance';

export type Compass = 'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';
const POINTS: Compass[] = ['east', 'northeast', 'north', 'northwest', 'west', 'southwest', 'south', 'southeast'];

/**
 * Direction as it looks on the flat map kids are holding (not the initial
 * great-circle heading, which can point north on an east-west flight).
 */
export function compassDirection(from: LngLat, to: LngLat): Compass {
  let dLng = to[0] - from[0];
  if (dLng > 180) dLng -= 360;
  if (dLng < -180) dLng += 360;
  const meanLat = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const angle = (Math.atan2(to[1] - from[1], dLng * Math.cos(meanLat)) * 180) / Math.PI; // 0 = east, 90 = north
  return POINTS[(Math.round(((angle + 360) % 360) / 45) % 8)]!;
}

export const COMPASS_ES: Record<Compass, string> = {
  north: 'norte', northeast: 'noreste', east: 'este', southeast: 'sureste',
  south: 'sur', southwest: 'suroeste', west: 'oeste', northwest: 'noroeste',
};

export function travel(from: LngLat, to: LngLat) {
  return { km: distanceKm(from, to), direction: compassDirection(from, to) };
}
