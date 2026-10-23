import { OfflineManager } from '@maplibre/maplibre-react-native';

import type { RegionPackInfo, TileDownloader } from './types';

/**
 * Detail tiles via MapLibre offline packs. Needs a style URL on a tile host we
 * control (EXPO_PUBLIC_DETAIL_STYLE_URL). Without it, packs are content-only.
 */
export function maplibreTileDownloader(styleUrl: string | undefined = process.env.EXPO_PUBLIC_DETAIL_STYLE_URL): TileDownloader | undefined {
  if (!styleUrl) return undefined;
  return {
    download: (pack, onProgress) =>
      new Promise<void>((resolve, reject) => {
        void OfflineManager.createPack(
          { mapStyle: styleUrl, bounds: pack.bbox, minZoom: pack.minZoom, maxZoom: pack.maxZoom, metadata: { packId: pack.id, version: pack.version } },
          (_p, status) => {
            onProgress(status.percentage / 100);
            if (status.state === 'complete') resolve();
          },
          (_p, error) => reject(new Error(error.message)),
        ).catch(reject);
      }),
    remove: async (packId) => {
      for (const p of await OfflineManager.getPacks()) if (p.metadata.packId === packId) await OfflineManager.deletePack(p.id);
    },
  };
}

export type { RegionPackInfo };
