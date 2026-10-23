import { act, render, screen, userEvent } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import i18n from '@/i18n';
import { PreferencesProvider } from '@/a11y/PreferencesContext';
import { countryRepository } from '@/content/countries';
import { buildPlaceCard } from '../model';
import { CountryList } from '../CountryList';
import { MapScreen } from '../MapScreen';
import { PlaceCardSheet } from '../PlaceCardSheet';

jest.mock('../glyphs', () => ({ prepareGlyphs: async () => 'file:///glyphs' }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const maplibre = require('@maplibre/maplibre-react-native') as { __setQueriedFeatures: (f: object[]) => void };

const wrap = (ui: React.ReactElement, prefs = {}) => <PreferencesProvider initial={prefs}>{ui}</PreferencesProvider>;

beforeEach(async () => {
  jest.clearAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

describe('PlaceCardSheet', () => {
  const kenya = buildPlaceCard({ kind: 'country', iso2: 'KE' }, countryRepository(), 'en')!;

  it('shows the flag with alt text, greeting, facts and a photo placeholder', async () => {
    await render(wrap(<PlaceCardSheet card={kenya} locale="en" onClose={() => {}} />));
    expect(screen.getByRole('header', { name: 'Kenya' })).toBeTruthy();
    expect(screen.getByLabelText(/^Flag of Kenya:/)).toBeTruthy();
    expect(screen.getByText('Jambo')).toBeTruthy();
    expect(screen.getByText('Photo coming soon')).toBeTruthy();
    expect(screen.getByLabelText('Capital: Nairobi')).toBeTruthy();
  });

  it('speaks the greeting with the matching voice tag, then its meaning', async () => {
    const user = userEvent.setup();
    await render(wrap(<PlaceCardSheet card={kenya} locale="en" onClose={() => {}} />));
    await user.press(screen.getByRole('button', { name: 'Hear the greeting' }));
    const calls = (Speech.speak as jest.Mock).mock.calls;
    expect(calls[0]).toEqual(['Jambo', expect.objectContaining({ language: 'sw-KE' })]);
    expect(calls[1]).toEqual(['Hello', expect.objectContaining({ language: 'en-US' })]);
    // No Swahili voice is installed in the test environment, so the card says so.
    expect(screen.getByText(/no voice for that language/)).toBeTruthy();
  });

  it('reads the card aloud automatically when the read-aloud preference is on', async () => {
    await render(wrap(<PlaceCardSheet card={kenya} locale="en" onClose={() => {}} />, { readAloud: true }));
    await act(async () => {});
    expect((Speech.speak as jest.Mock).mock.calls[0]?.[0]).toBe('Kenya. Africa · Eastern Africa.');
  });

  it('closes', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    await render(wrap(<PlaceCardSheet card={kenya} locale="en" onClose={onClose} />));
    await user.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CountryList', () => {
  it('filters as the student types and selects a country', async () => {
    const onSelect = jest.fn();
    const user = userEvent.setup();
    await render(wrap(<CountryList countries={countryRepository().all()} locale="en" onSelect={onSelect} />));
    await user.type(screen.getByLabelText('Search countries or capitals'), 'nairobi');
    await user.press(screen.getByRole('button', { name: 'Kenya. Capital: Nairobi' }));
    expect(onSelect).toHaveBeenCalledWith('KE');
  });

  it('explains when nothing matches', async () => {
    const user = userEvent.setup();
    await render(wrap(<CountryList countries={countryRepository().all()} locale="en" onSelect={() => {}} />));
    await user.type(screen.getByLabelText('Search countries or capitals'), 'atlantis');
    expect(screen.getByText(/No countries match/)).toBeTruthy();
  });
});

describe('MapScreen', () => {
  it('opens a country card when a country is tapped at country zoom', async () => {
    await render(wrap(<MapScreen />));
    const map = await screen.findByTestId('world-map');
    maplibre.__setQueriedFeatures([{ properties: { iso2: 'JP', continent: 'asia', playable: 1 } }]);
    await act(async () => {
      map.props.onRegionDidChange({ nativeEvent: { zoom: 3.2 } });
      await map.props.onPress({ nativeEvent: { point: [100, 100] } });
    });
    expect(screen.getByRole('header', { name: 'Japan' })).toBeTruthy();
  });

  it('shows the Antarctica card instead of flying to it', async () => {
    await render(wrap(<MapScreen />));
    const map = await screen.findByTestId('world-map');
    maplibre.__setQueriedFeatures([{ properties: { continent: 'antarctica', playable: 0 } }]);
    await act(async () => {
      map.props.onRegionDidChange({ nativeEvent: { zoom: 1 } });
      await map.props.onPress({ nativeEvent: { point: [10, 600] } });
    });
    expect(screen.getByTestId('antarctica-card')).toBeTruthy();
  });

  it('switches to the list and shows the card in Spanish', async () => {
    await act(() => i18n.changeLanguage('es'));
    const user = userEvent.setup();
    await render(wrap(<MapScreen />));
    await user.press(screen.getByRole('button', { name: 'Lista' }));
    await user.type(screen.getByLabelText('Busca países o capitales'), 'japon');
    await user.press(screen.getByRole('button', { name: 'Japón. Capital: Tokio' }));
    expect(screen.getByRole('header', { name: 'Japón' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escuchar el saludo' })).toBeTruthy();
  });
});
