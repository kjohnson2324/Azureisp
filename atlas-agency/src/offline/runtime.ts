import { maplibreTileDownloader } from './maplibreTiles';
import type { EvidenceApi, Outbox } from './outbox';
import { openSqliteProgress, type ProgressStore } from './progress';
import { loadCachedContent } from './regionPacks';
import { openSqliteCache } from './sqliteCache';
import { openSqliteOutbox } from './sqliteOutbox';
import { supabaseEvidenceApi } from './supabaseEvidenceApi';
import { supabaseContentApi } from './supabaseContentApi';
import type { ContentApi, ContentCache, TileDownloader } from './types';
import { countryRepository } from '@/content/countries';
import { createAtlasClient } from '@/lib/supabase';

export interface OfflineRuntime {
  cache: ContentCache;
  /** Undefined when the app has no backend configured (e.g. local demo builds). */
  api?: ContentApi;
  tiles?: TileDownloader;
  outbox: Outbox;
  progress: ProgressStore;
  /** Undefined without a backend; evidence then waits in the outbox. */
  evidence?: EvidenceApi;
}

let runtime: Promise<OfflineRuntime> | undefined;

/** Opens the device cache once and applies cached content to the shared repository. */
export function offlineRuntime(): Promise<OfflineRuntime> {
  runtime ??= (async () => {
    const cache = await openSqliteCache();
    await loadCachedContent(cache, countryRepository());
    const client = process.env.EXPO_PUBLIC_SUPABASE_URL ? createAtlasClient('shared') : undefined;
    const [outbox, progress] = await Promise.all([openSqliteOutbox(), openSqliteProgress()]);
    return {
      cache,
      api: client && supabaseContentApi(client),
      tiles: maplibreTileDownloader(),
      outbox,
      progress,
      evidence: client && supabaseEvidenceApi(client),
    };
  })();
  return runtime;
}
