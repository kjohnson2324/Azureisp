import { act, render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';
import { PreferencesProvider } from '@/a11y/PreferencesContext';
import { CountryRepository } from '@/content/countries';
import { DownloadsScreen, formatBytes } from '@/features/offline/DownloadsScreen';
import { MemoryContentCache } from '../memoryCache';
import { downloadRegionPack, loadCachedContent, packStatus, removeRegionPack, syncNewerCountries } from '../regionPacks';
import type { ContentApi, RegionPackInfo, TileDownloader } from '../types';

const base = new CountryRepository();
const jpV2 = { ...base.get('JP')!, facts: [...base.get('JP')!.facts, { en: 'Japan has over 14,000 islands.', es: 'Japón tiene más de 14.000 islas.' }] };

const asiaPack: RegionPackInfo = {
  id: 'asia', version: 1, name: { en: 'Asia', es: 'Asia' }, bbox: [25, -11, 150, 56], minZoom: 2, maxZoom: 8,
  manifest: [{ id: 'country:JP', version: 2 }, { id: 'country:KR', version: 1 }], contentBytes: 6000,
};

function fakeApi(overrides: Partial<ContentApi> = {}): ContentApi {
  return {
    listRegionPacks: async () => [asiaPack],
    fetchContent: async (refs) => refs.map((r) => ({ id: r.id, version: r.version, data: r.id === 'country:JP' ? jpV2 : base.get(r.id.slice(8))! })),
    currentCountryVersions: async () => [{ id: 'country:JP', version: 2 }, { id: 'country:KR', version: 1 }],
    ...overrides,
  };
}

describe('downloadRegionPack', () => {
  it('installs newer content, caches it, and reports progress', async () => {
    const repo = new CountryRepository();
    const cache = new MemoryContentCache();
    const progress: number[] = [];
    const result = await downloadRegionPack(asiaPack, { api: fakeApi(), cache, repo, now: () => new Date('2026-10-23T12:00:00Z') }, (f) => progress.push(f));
    expect(result).toEqual({ countriesUpdated: 1, tiles: false });
    expect(repo.get('JP')!.facts).toHaveLength(3);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(await cache.getInstalledPacks()).toEqual([{ id: 'asia', version: 1, installedAt: '2026-10-23T12:00:00.000Z', hasTiles: false }]);
  });

  it('survives a restart offline: cached content is re-applied with no network', async () => {
    const cache = new MemoryContentCache();
    await downloadRegionPack(asiaPack, { api: fakeApi(), cache, repo: new CountryRepository() });
    const afterRestart = new CountryRepository();
    expect(await loadCachedContent(cache, afterRestart)).toBe(1);
    expect(afterRestart.get('JP')!.facts).toHaveLength(3);
  });

  it('refuses a pack when the server returns incomplete content', async () => {
    const api = fakeApi({ fetchContent: async () => [] });
    const cache = new MemoryContentCache();
    await expect(downloadRegionPack(asiaPack, { api, cache, repo: new CountryRepository() })).rejects.toThrow(/expected 2 items/);
    expect(await cache.getInstalledPacks()).toEqual([]);
  });

  it('never applies content that breaks the contract', async () => {
    const api = fakeApi({ fetchContent: async (refs) => refs.map((r) => ({ ...r, data: { iso2: 'JP', clues: [] } })) });
    const repo = new CountryRepository();
    await downloadRegionPack(asiaPack, { api, cache: new MemoryContentCache(), repo });
    expect(repo.get('JP')!.facts).toHaveLength(2);
  });

  it('downloads tiles when the pack has them and a tile host is configured', async () => {
    const tiles: TileDownloader = { download: jest.fn(async (_p, onProgress) => { onProgress(0.5); onProgress(1); }), remove: jest.fn(async () => {}) };
    const pack = { ...asiaPack, tiles: { path: 'tiles/asia.pmtiles', bytes: 50_000_000, sha256: 'a'.repeat(64) } };
    const progress: number[] = [];
    const cache = new MemoryContentCache();
    const result = await downloadRegionPack(pack, { api: fakeApi(), cache, repo: new CountryRepository(), tiles }, (f) => progress.push(f));
    expect(result.tiles).toBe(true);
    expect(progress.map((f) => Math.round(f * 100))).toEqual([0, 20, 60, 100, 100]);
    await removeRegionPack('asia', { cache, tiles });
    expect(tiles.remove).toHaveBeenCalledWith('asia');
    expect(await cache.getInstalledPacks()).toEqual([]);
  });
});

describe('syncNewerCountries', () => {
  it('fetches only versions newer than the device has', async () => {
    const fetchContent = jest.fn(fakeApi().fetchContent);
    const repo = new CountryRepository();
    expect(await syncNewerCountries({ api: fakeApi({ fetchContent }), cache: new MemoryContentCache(), repo })).toBe(1);
    expect(fetchContent).toHaveBeenCalledWith([{ id: 'country:JP', version: 2 }]);
    expect(await syncNewerCountries({ api: fakeApi({ fetchContent }), cache: new MemoryContentCache(), repo })).toBe(0);
  });
});

describe('packStatus and sizes', () => {
  it('distinguishes available, installed and update', () => {
    expect(packStatus(asiaPack, [])).toBe('available');
    expect(packStatus(asiaPack, [{ id: 'asia', version: 1 }])).toBe('installed');
    expect(packStatus({ ...asiaPack, version: 2 }, [{ id: 'asia', version: 1 }])).toBe('update');
  });
  it('formats sizes per locale', () => {
    expect(formatBytes(150_000, 'en')).toBe('146 KB');
    expect(formatBytes(52_428_800, 'es')).toBe('50 MB');
    expect(formatBytes(1_572_864, 'es')).toBe('1,5 MB');
  });
});

describe('DownloadsScreen', () => {
  beforeEach(() => act(() => i18n.changeLanguage('en')));

  it('downloads a continent and then offers to remove it', async () => {
    const cache = new MemoryContentCache();
    const user = userEvent.setup();
    await render(
      <PreferencesProvider>
        <DownloadsScreen load={async () => ({ cache, api: fakeApi() })} />
      </PreferencesProvider>,
    );
    await user.press(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByText('✅ Ready offline')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(screen.getByText(/contain no student information/)).toBeTruthy();
  });

  it('explains when there is no backend to download from', async () => {
    await render(
      <PreferencesProvider>
        <DownloadsScreen load={async () => ({ cache: new MemoryContentCache() })} />
      </PreferencesProvider>,
    );
    expect(await screen.findByText('Connect to your class to download.')).toBeTruthy();
  });
});
