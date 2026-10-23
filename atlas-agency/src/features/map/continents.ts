import type { Localized } from '@/content/schemas';

/**
 * The seven-continent model taught in U.S. K-8 classrooms. Content keeps the
 * UN region (Africa, Americas, Asia, Europe, Oceania); the map splits the
 * Americas by UN subregion and adds Antarctica, which has no countries.
 */
export type ContinentId = 'africa' | 'antarctica' | 'asia' | 'europe' | 'north-america' | 'oceania' | 'south-america';

export interface ContinentView {
  id: ContinentId;
  name: Localized;
  /** Where the continent label sits on the world map. */
  label: [number, number];
  /** [west, south, east, north] framed when a player taps the continent. */
  bounds: [number, number, number, number];
  /** False for Antarctica: no countries to explore, just a fact card. */
  hasCountries: boolean;
}

// Hand-picked so each continent fills a phone screen. Oceania stops at the
// antimeridian; Samoa and Tonga sit just past it and appear at the right edge.
export const CONTINENTS: readonly ContinentView[] = [
  { id: 'africa', name: { en: 'Africa', es: 'África' }, label: [20, 5], bounds: [-20, -36, 53, 38], hasCountries: true },
  { id: 'antarctica', name: { en: 'Antarctica', es: 'Antártida' }, label: [20, -74], bounds: [-180, -80, 180, -62], hasCountries: false },
  { id: 'asia', name: { en: 'Asia', es: 'Asia' }, label: [90, 45], bounds: [25, -11, 150, 56], hasCountries: true },
  { id: 'europe', name: { en: 'Europe', es: 'Europa' }, label: [15, 52], bounds: [-25, 34, 45, 71], hasCountries: true },
  { id: 'north-america', name: { en: 'North America', es: 'América del Norte' }, label: [-100, 45], bounds: [-170, 7, -52, 72], hasCountries: true },
  { id: 'oceania', name: { en: 'Oceania', es: 'Oceanía' }, label: [140, -25], bounds: [110, -48, 180, 10], hasCountries: true },
  { id: 'south-america', name: { en: 'South America', es: 'América del Sur' }, label: [-60, -15], bounds: [-82, -56, -34, 13], hasCountries: true },
];

export const continentById = (id: string) => CONTINENTS.find((c) => c.id === id);

const NORTH_AMERICA_SUBREGIONS = new Set(['Northern America', 'Central America', 'Caribbean']);

/** Map a country's UN region and subregion to the seven-continent model. */
export function continentOf(region: string, subregion: string): ContinentId {
  switch (region) {
    case 'Africa': return 'africa';
    case 'Asia': return 'asia';
    case 'Europe': return 'europe';
    case 'Oceania': return 'oceania';
    case 'Americas': return NORTH_AMERICA_SUBREGIONS.has(subregion) ? 'north-america' : 'south-america';
    default: throw new Error(`unknown region ${region}`);
  }
}

/** UN M49 subregion names (as used by Natural Earth) in both launch languages. */
export const SUBREGIONS: Readonly<Record<string, Localized>> = {
  'Australia and New Zealand': { en: 'Australia and New Zealand', es: 'Australia y Nueva Zelanda' },
  Caribbean: { en: 'Caribbean', es: 'Caribe' },
  'Central America': { en: 'Central America', es: 'Centroamérica' },
  'Central Asia': { en: 'Central Asia', es: 'Asia central' },
  'Eastern Africa': { en: 'Eastern Africa', es: 'África oriental' },
  'Eastern Asia': { en: 'Eastern Asia', es: 'Asia oriental' },
  'Eastern Europe': { en: 'Eastern Europe', es: 'Europa oriental' },
  Melanesia: { en: 'Melanesia', es: 'Melanesia' },
  Micronesia: { en: 'Micronesia', es: 'Micronesia' },
  'Middle Africa': { en: 'Middle Africa', es: 'África central' },
  'Northern Africa': { en: 'Northern Africa', es: 'Norte de África' },
  'Northern America': { en: 'Northern America', es: 'América del Norte' },
  'Northern Europe': { en: 'Northern Europe', es: 'Europa del Norte' },
  Polynesia: { en: 'Polynesia', es: 'Polinesia' },
  'South America': { en: 'South America', es: 'Sudamérica' },
  'South-Eastern Asia': { en: 'Southeast Asia', es: 'Sudeste asiático' },
  'Southern Africa': { en: 'Southern Africa', es: 'África austral' },
  'Southern Asia': { en: 'Southern Asia', es: 'Asia meridional' },
  'Southern Europe': { en: 'Southern Europe', es: 'Europa del Sur' },
  'Western Africa': { en: 'Western Africa', es: 'África occidental' },
  'Western Asia': { en: 'Western Asia', es: 'Asia occidental' },
  'Western Europe': { en: 'Western Europe', es: 'Europa occidental' },
};

/** Shown when a player taps Antarctica. */
export const ANTARCTICA_FACTS: readonly Localized[] = [
  { en: 'Antarctica is the coldest, windiest and driest continent.', es: 'La Antártida es el continente más frío, ventoso y seco.' },
  { en: 'No country owns Antarctica; nations share it for science under the Antarctic Treaty.', es: 'Ningún país es dueño de la Antártida; las naciones la comparten para la ciencia gracias al Tratado Antártico.' },
  { en: 'About 90 percent of the ice on Earth is in Antarctica.', es: 'Cerca del 90 por ciento del hielo de la Tierra está en la Antártida.' },
];
