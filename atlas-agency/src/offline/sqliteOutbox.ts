import * as SQLite from 'expo-sqlite';

import type { Outbox, OutboxItem } from './outbox';

export async function openSqliteOutbox(): Promise<Outbox> {
  const db = await SQLite.openDatabaseAsync('atlas-outbox.db');
  await db.execAsync(`
    pragma journal_mode = wal;
    create table if not exists outbox (
      key text primary key, kind text not null, student_id text not null, row text not null, created_at text not null
    );
    create index if not exists outbox_student on outbox (student_id);
  `);
  const put = (key: string, kind: string, studentId: string, row: unknown) =>
    db.runAsync(
      `insert into outbox (key, kind, student_id, row, created_at) values (?, ?, ?, ?, datetime('now'))
       on conflict (key) do update set row = excluded.row`,
      key, kind, studentId, JSON.stringify(row),
    );
  return {
    putAttempt: async (studentId, row) => { await put(`attempt:${row.id}`, 'attempt', studentId, row); },
    addAnswers: async (studentId, rows) => {
      await db.withTransactionAsync(async () => {
        for (const row of rows) await put(`answer:${row.id}`, 'answer', studentId, row);
      });
    },
    pending: async (studentId) => {
      const rows = await db.getAllAsync<{ key: string; kind: string; student_id: string; row: string }>(
        'select key, kind, student_id, row from outbox where student_id = ? order by created_at', studentId);
      return rows.map((r) => ({ key: r.key, kind: r.kind, studentId: r.student_id, row: JSON.parse(r.row) }) as OutboxItem);
    },
    remove: async (keys) => {
      await db.withTransactionAsync(async () => {
        for (const k of keys) await db.runAsync('delete from outbox where key = ?', k);
      });
    },
    purge: async (studentId) => { await db.runAsync('delete from outbox where student_id = ?', studentId); },
  };
}
