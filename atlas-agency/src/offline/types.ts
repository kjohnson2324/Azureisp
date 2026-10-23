import type { Localized } from '@/content/schemas';

export interface ContentRef {
  id: string;
  version: number;
}

export interface RegionPackInfo {
  id: string;
  version: number;
  name: Localized;
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  manifest: ContentRef[];
  contentBytes: number;
  tiles?: { path: string; bytes: number; sha256: string };
}

export interface InstalledPack {
  id: string;
  version: number;
  installedAt: string;
  hasTiles: boolean;
}

/** Device-level cache. Holds published content only, never student data. */
export interface ContentCache {
  getCountries(): Promise<{ version: number; data: unknown }[]>;
  putCountries(items: readonly { version: number; data: unknown; id: string }[]): Promise<void>;
  getInstalledPacks(): Promise<InstalledPack[]>;
  markPackInstalled(pack: InstalledPack): Promise<void>;
  removePack(id: string): Promise<void>;
}

/** Server reads. Implemented over Supabase; faked in tests. */
export interface ContentApi {
  listRegionPacks(): Promise<RegionPackInfo[]>;
  fetchContent(refs: readonly ContentRef[]): Promise<{ id: string; version: number; data: unknown }[]>;
  /** Latest published version of every country (id + version only). */
  currentCountryVersions(): Promise<ContentRef[]>;
}

/** Map tile downloads (MapLibre offline packs). Optional until a tile host is chosen. */
export interface TileDownloader {
  download(pack: RegionPackInfo, onProgress: (fraction: number) => void): Promise<void>;
  remove(packId: string): Promise<void>;
}
