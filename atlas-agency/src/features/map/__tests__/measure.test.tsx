import { act, render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';
import { PreferencesProvider } from '@/a11y/PreferencesContext';
import { defaultPreferences, syncablePreferences } from '@/a11y/preferences';
import { countryRepository } from '@/content/countries';
import { compareToSchoolTrips, distanceKm, KM_PER_MILE } from '../distance';
import { MapScreen } from '../MapScreen';
import { measurePointFromTap, placePoint, pointLabel, searchPlaces } from '../measure';
import { MeasurePanel } from '../MeasurePanel';

jest.mock('../glyphs', () => ({ prepareGlyphs: async () => 'file:///glyphs' }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const maplibre = require('@maplibre/maplibre-react-native') as { __setQueriedFeatures: (f: object[]) => void };

const repo = countryRepository();
const t = (k: string, o?: Record<string, string>) => i18n.t(k, o);
const wrap = (ui: React.ReactElement, prefs = {}) => <PreferencesProvider initial={prefs}>{ui}</PreferencesProvider>;

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

describe('measure points', () => {
  it('snaps a tap to the capital under the finger', () => {
    const p = measurePointFromTap([{ properties: { id: 'capital:KE', kind: 'capital', iso2: 'KE' } }, { properties: { iso2: 'KE', playable: 1 } }], [30, 0]);
    expect(p).toMatchObject({ kind: 'place', id: 'capital:KE', name: { en: 'Nairobi' } });
    expect(p.coord).toEqual(placePoint('capital:KE')!.coord);
  });

  it('uses the exact spot inside a country, or in the ocean', () => {
    const land = measurePointFromTap([{ properties: { iso2: 'BR', playable: 1 } }], [-50, -10]);
    expect(pointLabel(land, 'en', repo, t)).toBe('A spot in Brazil');
    const sea = measurePointFromTap([], [-30, 0]);
    expect(pointLabel(sea, 'es', repo, (k, o) => i18n.t(k, { ...o, lng: 'es' }))).toBe('Un lugar en el océano');
  });

  it('searches capitals and cities in either language, capitals first', () => {
    const r = searchPlaces('lon', 'en', repo);
    expect(r[0]).toEqual({ id: 'capital:GB', name: 'London', country: 'United Kingdom' });
    expect(searchPlaces('pekin', 'es', repo)[0]).toMatchObject({ id: 'capital:CN', name: 'Pekín', country: 'China' });
    expect(searchPlaces('', 'en', repo)).toEqual([]);
  });
});

describe('privacy', () => {
  it('never syncs the school-to-home distance to the server', () => {
    const prefs = { ...defaultPreferences, schoolTripKm: 3.2, units: 'imperial' as const };
    const synced = syncablePreferences(prefs);
    expect(synced).not.toHaveProperty('schoolTripKm');
    expect(synced).toHaveProperty('units', 'imperial');
  });
});

describe('MeasurePanel', () => {
  const nairobi = placePoint('capital:KE')!;
  const tokyo = placePoint('capital:JP')!;
  const km = distanceKm(nairobi.coord, tokyo.coord);

  it('picks two places by search and shows distance in both units plus school trips', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    const { rerender } = await render(wrap(<MeasurePanel locale="en" onChange={onChange} onDone={() => {}} />, { units: 'imperial', schoolTripKm: KM_PER_MILE }));
    await user.type(screen.getByLabelText('From: Search a place'), 'nairo');
    await user.press(screen.getByRole('button', { name: 'Nairobi, Kenya' }));
    expect(onChange).toHaveBeenLastCalledWith(nairobi, undefined);

    await rerender(wrap(<MeasurePanel locale="en" from={nairobi} to={tokyo} onChange={onChange} onDone={() => {}} />, { units: 'imperial', schoolTripKm: KM_PER_MILE }));
    const miles = Math.round(km / KM_PER_MILE).toLocaleString('en-US');
    expect(screen.getByText(`${miles} miles`)).toBeTruthy();
    expect(screen.getByText(`${Math.round(km).toLocaleString('en-US')} km`)).toBeTruthy();
    const trips = compareToSchoolTrips(km, KM_PER_MILE, 'en').count;
    expect(screen.getByText(`🏫 ↔ 🏠  That's like going from school to home and back about ${trips} times!`)).toBeTruthy();
    expect(screen.getByText('(if school is about 1 mile from home)')).toBeTruthy();
  });

  it('recounts when the student picks a different school distance', async () => {
    const user = userEvent.setup();
    await render(wrap(<MeasurePanel locale="en" from={nairobi} to={tokyo} onChange={() => {}} onDone={() => {}} />, { units: 'metric', schoolTripKm: 2 }));
    expect(screen.getByText(new RegExp(`about ${compareToSchoolTrips(km, 2, 'en').count} times`))).toBeTruthy();
    await user.press(screen.getByRole('radio', { name: '5 km' }));
    expect(screen.getByText(new RegExp(`about ${compareToSchoolTrips(km, 5, 'en').count} times`))).toBeTruthy();
    expect(screen.getByRole('radio', { name: '5 km' })).toBeChecked();
  });

  it('counts with the distance shown, even when the stored value sits between choices', async () => {
    // Default 2 km shows as "about 1 mile" in miles, so the count must use 1 mile too.
    await render(wrap(<MeasurePanel locale="en" from={nairobi} to={tokyo} onChange={() => {}} onDone={() => {}} />, { units: 'imperial', schoolTripKm: 2 }));
    expect(screen.getByText('(if school is about 1 mile from home)')).toBeTruthy();
    expect(screen.getByText(new RegExp(`about ${compareToSchoolTrips(km, KM_PER_MILE, 'en').count} times`))).toBeTruthy();
  });

  it('switches units without losing the school distance', async () => {
    const user = userEvent.setup();
    await render(wrap(<MeasurePanel locale="en" from={nairobi} to={tokyo} onChange={() => {}} onDone={() => {}} />, { units: 'metric', schoolTripKm: 2 }));
    await user.press(screen.getByRole('radio', { name: 'Miles' }));
    expect(screen.getByText('(if school is about 1 mile from home)')).toBeTruthy();
  });

  it('works in Spanish', async () => {
    await act(() => i18n.changeLanguage('es'));
    await render(wrap(<MeasurePanel locale="es" from={nairobi} to={tokyo} onChange={() => {}} onDone={() => {}} />, { units: 'metric', schoolTripKm: 2 }));
    expect(screen.getByText(/¡Es como ir de la escuela a la casa y volver unas [\d,]+ veces!/)).toBeTruthy();
    expect(screen.getByText('(si la escuela está a unos 2 km de tu casa)')).toBeTruthy();
  });
});

describe('MapScreen measuring', () => {
  it('measures between two tapped places and draws the path', async () => {
    const user = userEvent.setup();
    await render(wrap(<MapScreen />, { units: 'metric' }));
    await screen.findByTestId('world-map');
    await user.press(screen.getByRole('button', { name: 'Measure' }));
    // Re-read the map element after each state change, as a real tap would hit the current handler.
    const tap = async (id: string, iso2: string, lngLat: [number, number]) => {
      const map = screen.getByTestId('world-map');
      maplibre.__setQueriedFeatures([{ properties: { id, kind: 'capital', iso2 } }]);
      await act(async () => {
        map.props.onRegionDidChange({ nativeEvent: { zoom: 5 } });
        await map.props.onPress({ nativeEvent: { point: [1, 1], lngLat } });
      });
    };
    await tap('capital:FR', 'FR', [2.35, 48.86]);
    await tap('capital:GB', 'GB', [-0.12, 51.5]);
    expect(screen.getByText('A · From: Paris')).toBeTruthy();
    expect(screen.getByText('B · To: London')).toBeTruthy();
    const km = distanceKm(placePoint('capital:FR')!.coord, placePoint('capital:GB')!.coord);
    expect(screen.getByText(`${Math.round(km)} km`)).toBeTruthy();
    // Measuring never opens a place card.
    expect(screen.queryByTestId('place-card')).toBeNull();
  });

  it('starts a measurement from a place card', async () => {
    const user = userEvent.setup();
    await render(wrap(<MapScreen />));
    const map = await screen.findByTestId('world-map');
    maplibre.__setQueriedFeatures([{ properties: { iso2: 'JP', continent: 'asia', playable: 1 } }]);
    await act(async () => {
      map.props.onRegionDidChange({ nativeEvent: { zoom: 3 } });
      await map.props.onPress({ nativeEvent: { point: [1, 1], lngLat: [138, 36] } });
    });
    await user.press(screen.getByRole('button', { name: 'Measure from here' }));
    expect(screen.getByText('A · From: Tokyo')).toBeTruthy();
  });
});
