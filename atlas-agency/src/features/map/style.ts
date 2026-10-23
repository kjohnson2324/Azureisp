// The world map style, shared by the app (MapLibre Native) and the browser
// preview (MapLibre GL JS). Everything renders from bundled data: no tile
// server, no third-party requests.
//
// Zoom tiers
//   < 2.5   continents (7-continent model): big labels, tap a continent to fly there
//   2.5–4   countries:  country names, tap a country for its card
//   ≥ 4     places:     capitals (double ring), then major cities (single dot)
//
// Colour is never the only signal: continents differ by colour AND are labelled,
// capitals differ from cities by ring shape and label weight, and the selected
// country gets a thick dashed outline.
import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { CONTINENTS } from './continents';
import { continentFill, darkTheme, lightTheme, palette } from '@/theme/tokens';

export const GLYPH_FONTS = ['NotoSans-Regular', 'NotoSans-Medium'] as const;
export const TIER = { countries: 2.5, capitals: 4, cities: 4.75 } as const;

/** Keep the camera off the far poles (Mercator makes them huge). */
export const WORLD_BOUNDS: [number, number, number, number] = [-180, -80, 180, 84];
export const WORLD_VIEW: [number, number, number, number] = [-170, -58, 180, 75];

export const LAYER = {
  fill: 'countries-fill',
  outline: 'countries-outline',
  continentLabels: 'continent-labels',
  countryLabels: 'country-labels',
  capitals: 'places-capitals',
  cities: 'places-cities',
  capitalLabels: 'capital-labels',
  cityLabels: 'city-labels',
} as const;

/** Layers that can be tapped, highest priority first. */
export const TAPPABLE_LAYERS = [LAYER.capitals, LAYER.cities, LAYER.fill];

export interface MapStyleOptions {
  locale: 'en' | 'es';
  /** URL template base; the style appends /{fontstack}/{range}.pbf */
  glyphsBase: string;
  countries: GeoJSON.FeatureCollection;
  places: GeoJSON.FeatureCollection;
  /** Country label anchor points (from content `center`). */
  countryLabels: GeoJSON.FeatureCollection;
  highContrast?: boolean;
  dark?: boolean;
  /** 1–2, from the student's text-size preference. */
  textScale?: number;
}

const NEUTRAL_LAND = { light: '#D9D6CF', dark: '#3A3D55' };

export function buildMapStyle(o: MapStyleOptions): StyleSpecification {
  const theme = o.dark ? darkTheme : lightTheme;
  const s = o.textScale ?? 1;
  const name = ['get', o.locale === 'es' ? 'name_es' : 'name_en'];
  const halo = o.dark ? '#11132A' : palette.white;

  const regionColor = o.highContrast
    ? (o.dark ? '#1B1F3B' : palette.white)
    : ['match', ['get', 'continent'],
        ...Object.entries(continentFill).flat(),
        o.dark ? NEUTRAL_LAND.dark : NEUTRAL_LAND.light];

  const continentPoints: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: CONTINENTS.map((c) => ({
      type: 'Feature',
      properties: { continent: c.id, name_en: c.name.en, name_es: c.name.es },
      geometry: { type: 'Point', coordinates: c.label },
    })),
  };

  const placeLabelLayer = (id: string, filter: unknown[], minzoom: number, font: string, size: number) => ({
    id,
    type: 'symbol',
    source: 'places',
    minzoom,
    filter,
    layout: {
      'text-field': name,
      'text-font': [font],
      'text-size': size,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: { 'text-color': theme.text, 'text-halo-color': halo, 'text-halo-width': 2 },
  });

  return {
    version: 8,
    name: 'Atlas Agency world',
    glyphs: `${o.glyphsBase}/{fontstack}/{range}.pbf`,
    sources: {
      countries: { type: 'geojson', data: o.countries, attribution: 'Natural Earth' },
      places: { type: 'geojson', data: o.places },
      countryLabels: { type: 'geojson', data: o.countryLabels },
      continents: { type: 'geojson', data: continentPoints },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': theme.mapWater } },
      {
        id: LAYER.fill,
        type: 'fill',
        source: 'countries',
        paint: {
          'fill-color': regionColor as never,
          'fill-opacity': ['case', ['any', ['==', ['get', 'playable'], 1], ['has', 'continent']], 1, 0.8],
        },
      },
      {
        id: LAYER.outline,
        type: 'line',
        source: 'countries',
        paint: {
          'line-color': theme.mapBorder,
          'line-width': o.highContrast
            ? ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 3]
            : ['interpolate', ['linear'], ['zoom'], 0, 0.3, 3, 0.8, 6, 1.6],
        },
      },
      {
        id: LAYER.continentLabels,
        type: 'symbol',
        source: 'continents',
        maxzoom: TIER.countries,
        layout: {
          'text-field': name as never,
          'text-font': ['NotoSans-Medium'],
          'text-size': 18 * s,
          'text-transform': 'uppercase',
          'text-letter-spacing': 0.1,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': theme.text, 'text-halo-color': halo, 'text-halo-width': 2.5 },
      },
      {
        id: LAYER.countryLabels,
        type: 'symbol',
        source: 'countryLabels',
        minzoom: TIER.countries,
        layout: {
          'text-field': name as never,
          'text-font': ['NotoSans-Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], TIER.countries, 11 * s, 6, 16 * s],
          'text-max-width': 7,
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: { 'text-color': theme.text, 'text-halo-color': halo, 'text-halo-width': 2 },
      },
      {
        id: LAYER.cities,
        type: 'circle',
        source: 'places',
        minzoom: TIER.cities,
        filter: ['!=', ['get', 'kind'], 'capital'],
        paint: {
          'circle-radius': 4,
          'circle-color': theme.text,
          'circle-stroke-color': halo,
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: LAYER.capitals,
        type: 'circle',
        source: 'places',
        minzoom: TIER.capitals,
        filter: ['==', ['get', 'kind'], 'capital'],
        paint: {
          'circle-radius': 7,
          'circle-color': halo,
          'circle-stroke-color': theme.text,
          'circle-stroke-width': 3,
        },
      },
      // Two label layers (not one filtered by zoom): filters see whole-number zoom
      // levels, so a zoom filter would hide city names until zoom 5.
      placeLabelLayer(LAYER.capitalLabels, ['==', ['get', 'kind'], 'capital'], TIER.capitals, 'NotoSans-Medium', 13 * s),
      placeLabelLayer(LAYER.cityLabels, ['!=', ['get', 'kind'], 'capital'], TIER.cities, 'NotoSans-Regular', 11 * s),
    ],
  } as StyleSpecification;
}

/** Thick dashed outline for the selected country (rendered as a separate source). */
export function selectionLayer(dark = false) {
  return {
    id: 'selection-outline',
    type: 'line' as const,
    paint: {
      'line-color': dark ? palette.yellow : palette.blue,
      'line-width': 4,
      'line-dasharray': [2, 1],
    },
  };
}
