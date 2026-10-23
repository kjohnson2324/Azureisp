import type { ContentCache, InstalledPack } from './types';

/** In-memory cache for tests and for shared devices that opt out of local storage. */
export class MemoryContentCache implements ContentCache {
  private readonly countries = new Map<string, { version: number; data: unknown }>();
  private readonly packs = new Map<string, InstalledPack>();

  async getCountries() {
    return [...this.countries.values()];
  }
  async putCountries(items: readonly { id: string; version: number; data: unknown }[]) {
    for (const i of items) {
      const cur = this.countries.get(i.id);
      if (!cur || cur.version < i.version) this.countries.set(i.id, { version: i.version, data: i.data });
    }
  }
  async getInstalledPacks() {
    return [...this.packs.values()];
  }
  async markPackInstalled(pack: InstalledPack) {
    this.packs.set(pack.id, pack);
  }
  async removePack(id: string) {
    this.packs.delete(id);
  }
}
