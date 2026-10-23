import * as SQLite from 'expo-sqlite';

import type { ContentCache, InstalledPack } from './types';

/** SQLite-backed content cache (device-level, published content only). */
export async function openSqliteCache(): Promise<ContentCache> {
  const db = await SQLite.openDatabaseAsync('atlas-content.db');
  await db.execAsync(`
    pragma journal_mode = wal;
    create table if not exists content (
      id text primary key, kind text not null, version integer not null, data text not null
    );
    create table if not exists packs (
      id text primary key, version integer not null, installed_at text not null, has_tiles integer not null
    );
  `);
  return {
    async getCountries() {
      const rows = await db.getAllAsync<{ version: number; data: string }>("select version, data from content where kind = 'country'");
      return rows.map((r) => ({ version: r.version, data: JSON.parse(r.data) as unknown }));
    },
    async putCountries(items) {
      await db.withTransactionAsync(async () => {
        for (const i of items) {
          await db.runAsync(
            `insert into content (id, kind, version, data) values (?, 'country', ?, ?)
             on conflict (id) do update set version = excluded.version, data = excluded.data
             where excluded.version > content.version`,
            i.id, i.version, JSON.stringify(i.data),
          );
        }
      });
    },
    async getInstalledPacks() {
      const rows = await db.getAllAsync<{ id: string; version: number; installed_at: string; has_tiles: number }>('select * from packs');
      return rows.map((r): InstalledPack => ({ id: r.id, version: r.version, installedAt: r.installed_at, hasTiles: r.has_tiles === 1 }));
    },
    async markPackInstalled(p) {
      await db.runAsync(
        'insert or replace into packs (id, version, installed_at, has_tiles) values (?, ?, ?, ?)',
        p.id, p.version, p.installedAt, p.hasTiles ? 1 : 0,
      );
    },
    async removePack(id) {
      await db.runAsync('delete from packs where id = ?', id);
    },
  };
}
