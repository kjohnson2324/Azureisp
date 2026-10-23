// MapLibre Native loads label glyphs from a URL template. To work offline on
// first launch we copy the bundled PBFs into the app's document directory once
// and point the style at file://…/glyphs/{fontstack}/{range}.pbf.
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

import { GLYPH_ASSETS } from './glyphAssets';

const GLYPH_VERSION = '1';

export async function prepareGlyphs(): Promise<string> {
  const root = new Directory(Paths.document, 'map-glyphs', GLYPH_VERSION);
  const marker = new File(root, '.complete');
  if (!marker.exists) {
    for (const [key, module] of Object.entries(GLYPH_ASSETS)) {
      const [font, range] = key.split('/') as [string, string];
      const dir = new Directory(root, font);
      if (!dir.exists) dir.create({ intermediates: true });
      const asset = await Asset.fromModule(module).downloadAsync();
      const dest = new File(dir, `${range}.pbf`);
      if (dest.exists) dest.delete();
      await new File(asset.localUri ?? asset.uri).copy(dest);
    }
    marker.create();
  }
  return root.uri.replace(/\/$/, '');
}
