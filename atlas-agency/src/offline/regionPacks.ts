// Offline region packs. A pack installs the newest published content for a
// continent into the device cache and, once a tile host is configured, the
// detailed map tiles for that area. The whole-world base map is always bundled,
// so the map works offline even with no packs installed.
import type { ContentApi, ContentCache, RegionPackInfo, TileDownloader } from './types';
import type { CountryRepository } from '@/content/countries';

export interface PackDeps {
  api: ContentApi;
  cache: ContentCache;
  repo: CountryRepository;
  tiles?: TileDownloader;
  now?: () => Date;
}

export class PackDownloadError extends Error {}

/** Load cached content into the repository (works with no network). */
export async function loadCachedContent(cache: ContentCache, repo: CountryRepository): Promise<number> {
  return repo.apply((await cache.getCountries()) as never);
}

export async function downloadRegionPack(
  pack: RegionPackInfo,
  deps: PackDeps,
  onProgress: (fraction: number) => void = () => {},
): Promise<{ countriesUpdated: number; tiles: boolean }> {
  const contentShare = pack.tiles && deps.tiles ? 0.2 : 1;
  onProgress(0);

  const items = await deps.api.fetchContent(pack.manifest);
  const wanted = new Set(pack.manifest.map((r) => `${r.id}@${r.version}`));
  const got = items.filter((i) => wanted.has(`${i.id}@${i.version}`));
  if (got.length !== pack.manifest.length) {
    throw new PackDownloadError(`pack ${pack.id}: expected ${pack.manifest.length} items, received ${got.length}`);
  }

  // Validate before persisting: the repository rejects anything off-contract.
  const countriesUpdated = deps.repo.apply(got.map((i) => ({ version: i.version, data: i.data as never })));
  await deps.cache.putCountries(got);
  onProgress(contentShare);

  let tiles = false;
  if (pack.tiles && deps.tiles) {
    await deps.tiles.download(pack, (f) => onProgress(contentShare + (1 - contentShare) * f));
    tiles = true;
  }

  await deps.cache.markPackInstalled({ id: pack.id, version: pack.version, installedAt: (deps.now?.() ?? new Date()).toISOString(), hasTiles: tiles });
  onProgress(1);
  return { countriesUpdated, tiles };
}

export async function removeRegionPack(id: string, deps: Pick<PackDeps, 'cache' | 'tiles'>) {
  await deps.tiles?.remove(id);
  // Cached content stays: it is small, still valid, and other packs may share it.
  await deps.cache.removePack(id);
}

/** Pull any country versions newer than what the device has (call after sign-in, when online). */
export async function syncNewerCountries(deps: Pick<PackDeps, 'api' | 'cache' | 'repo'>): Promise<number> {
  const current = await deps.api.currentCountryVersions();
  const stale = current.filter((r) => (deps.repo.version(r.id.replace(/^country:/, '')) ?? 0) < r.version);
  if (stale.length === 0) return 0;
  const items = await deps.api.fetchContent(stale);
  const applied = deps.repo.apply(items.map((i) => ({ version: i.version, data: i.data as never })));
  await deps.cache.putCountries(items);
  return applied;
}

export function packStatus(pack: RegionPackInfo, installed: readonly { id: string; version: number }[]) {
  const mine = installed.find((p) => p.id === pack.id);
  if (!mine) return 'available' as const;
  return mine.version < pack.version ? ('update' as const) : ('installed' as const);
}

export const packBytes = (pack: RegionPackInfo) => pack.contentBytes + (pack.tiles?.bytes ?? 0);
