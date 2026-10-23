// Which cases this student has solved on this device (for the case list).
// The server's mission_attempts table is the record of truth once synced.
import * as SQLite from 'expo-sqlite';

export interface ProgressStore {
  solved(studentId: string): Promise<Map<string, number>>;
  markSolved(studentId: string, missionId: string, points: number): Promise<void>;
}

export class MemoryProgressStore implements ProgressStore {
  private readonly data = new Map<string, Map<string, number>>();
  async solved(studentId: string) {
    return new Map(this.data.get(studentId) ?? []);
  }
  async markSolved(studentId: string, missionId: string, points: number) {
    const mine = this.data.get(studentId) ?? new Map<string, number>();
    mine.set(missionId, Math.max(points, mine.get(missionId) ?? 0));
    this.data.set(studentId, mine);
  }
}

export async function openSqliteProgress(): Promise<ProgressStore> {
  const db = await SQLite.openDatabaseAsync('atlas-outbox.db');
  await db.execAsync(`
    create table if not exists solved (
      student_id text not null, mission_id text not null, best_points integer not null,
      primary key (student_id, mission_id)
    );
  `);
  return {
    async solved(studentId) {
      const rows = await db.getAllAsync<{ mission_id: string; best_points: number }>('select mission_id, best_points from solved where student_id = ?', studentId);
      return new Map(rows.map((r) => [r.mission_id, r.best_points]));
    },
    async markSolved(studentId, missionId, points) {
      await db.runAsync(
        `insert into solved (student_id, mission_id, best_points) values (?, ?, ?)
         on conflict (student_id, mission_id) do update set best_points = max(best_points, excluded.best_points)`,
        studentId, missionId, points,
      );
    },
  };
}
