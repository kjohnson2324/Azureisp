import type { SupabaseClient } from '@supabase/supabase-js';

import type { ContentApi, ContentRef, RegionPackInfo } from './types';

type PackRow = {
  id: string; version: number; name_en: string; name_es: string; bbox: number[]; min_zoom: number; max_zoom: number;
  manifest: ContentRef[]; content_bytes: number; tiles_path: string | null; tiles_bytes: number | null; tiles_sha256: string | null;
};

/** Reads published content as the signed-in user (RLS: any authenticated role may read published content). */
export function supabaseContentApi(client: SupabaseClient): ContentApi {
  return {
    async listRegionPacks() {
      const { data, error } = await client
        .from('region_packs')
        .select('id, version, name_en, name_es, bbox, min_zoom, max_zoom, manifest, content_bytes, tiles_path, tiles_bytes, tiles_sha256')
        .eq('status', 'published')
        .order('id')
        .order('version', { ascending: false });
      if (error) throw error;
      const latest = new Map<string, PackRow>();
      for (const r of (data ?? []) as PackRow[]) if (!latest.has(r.id)) latest.set(r.id, r);
      return [...latest.values()].map((r): RegionPackInfo => ({
        id: r.id,
        version: r.version,
        name: { en: r.name_en, es: r.name_es },
        bbox: r.bbox as RegionPackInfo['bbox'],
        minZoom: r.min_zoom,
        maxZoom: r.max_zoom,
        manifest: r.manifest,
        contentBytes: r.content_bytes,
        tiles: r.tiles_path ? { path: r.tiles_path, bytes: r.tiles_bytes ?? 0, sha256: r.tiles_sha256 ?? '' } : undefined,
      }));
    },
    async fetchContent(refs) {
      const out: { id: string; version: number; data: unknown }[] = [];
      for (let i = 0; i < refs.length; i += 50) {
        const chunk = refs.slice(i, i + 50);
        const { data, error } = await client
          .from('content_items')
          .select('id, version, data')
          .in('id', chunk.map((r) => r.id))
          .in('version', [...new Set(chunk.map((r) => r.version))]);
        if (error) throw error;
        const wanted = new Set(chunk.map((r) => `${r.id}@${r.version}`));
        out.push(...((data ?? []) as typeof out).filter((d) => wanted.has(`${d.id}@${d.version}`)));
      }
      return out;
    },
    async currentCountryVersions() {
      const { data, error } = await client.from('content_current').select('id, version').eq('kind', 'country');
      if (error) throw error;
      return (data ?? []) as ContentRef[];
    },
  };
}
