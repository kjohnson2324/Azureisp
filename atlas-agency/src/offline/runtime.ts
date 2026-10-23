import { maplibreTileDownloader } from './maplibreTiles';
import { loadCachedContent } from './regionPacks';
import { openSqliteCache } from './sqliteCache';
import { supabaseContentApi } from './supabaseContentApi';
import type { ContentApi, ContentCache, TileDownloader } from './types';
import { countryRepository } from '@/content/countries';
import { createAtlasClient } from '@/lib/supabase';

export interface OfflineRuntime {
  cache: ContentCache;
  /** Undefined when the app has no backend configured (e.g. local demo builds). */
  api?: ContentApi;
  tiles?: TileDownloader;
}

let runtime: Promise<OfflineRuntime> | undefined;

/** Opens the device cache once and applies cached content to the shared repository. */
export function offlineRuntime(): Promise<OfflineRuntime> {
  runtime ??= (async () => {
    const cache = await openSqliteCache();
    await loadCachedContent(cache, countryRepository());
    const api = process.env.EXPO_PUBLIC_SUPABASE_URL ? supabaseContentApi(createAtlasClient('shared')) : undefined;
    return { cache, api, tiles: maplibreTileDownloader() };
  })();
  return runtime;
}
