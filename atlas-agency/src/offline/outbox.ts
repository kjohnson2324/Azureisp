// Offline outbox for learning evidence (mission attempts + answer events).
//
// Shared devices: every row records which student produced it. Only rows for
// the signed-in student are uploaded, so one student's answers are never sent
// under another's login. Rows created before sign-in exists use studentId
// "local" and are kept on the device only.
import type { AnswerEventRow, AttemptRow } from '@/features/missions/engine';

export type OutboxItem =
  | { key: string; kind: 'attempt'; studentId: string; row: AttemptRow }
  | { key: string; kind: 'answer'; studentId: string; row: AnswerEventRow };

export interface Outbox {
  /** Attempts are keyed by id, so the latest state replaces earlier ones. */
  putAttempt(studentId: string, row: AttemptRow): Promise<void>;
  addAnswers(studentId: string, rows: readonly AnswerEventRow[]): Promise<void>;
  pending(studentId: string): Promise<OutboxItem[]>;
  remove(keys: readonly string[]): Promise<void>;
  /** Shared-device sign-out after a successful flush: drop anything left for that student. */
  purge(studentId: string): Promise<void>;
}

export class MemoryOutbox implements Outbox {
  private readonly items = new Map<string, OutboxItem>();
  async putAttempt(studentId: string, row: AttemptRow) {
    this.items.set(`attempt:${row.id}`, { key: `attempt:${row.id}`, kind: 'attempt', studentId, row });
  }
  async addAnswers(studentId: string, rows: readonly AnswerEventRow[]) {
    for (const row of rows) this.items.set(`answer:${row.id}`, { key: `answer:${row.id}`, kind: 'answer', studentId, row });
  }
  async pending(studentId: string) {
    return [...this.items.values()].filter((i) => i.studentId === studentId);
  }
  async remove(keys: readonly string[]) {
    for (const k of keys) this.items.delete(k);
  }
  async purge(studentId: string) {
    for (const [k, i] of this.items) if (i.studentId === studentId) this.items.delete(k);
  }
}

/** Server writes, as the signed-in student (RLS: student_id must equal auth.uid()). */
export interface EvidenceApi {
  /** Insert attempts that don't exist yet, then update the client-writable columns. */
  saveAttempts(studentId: string, rows: readonly AttemptRow[]): Promise<void>;
  /** Idempotent: re-sending an answer id is a no-op. */
  insertAnswers(studentId: string, rows: readonly AnswerEventRow[]): Promise<void>;
}

export async function flushOutbox(outbox: Outbox, api: EvidenceApi, studentId: string): Promise<{ attempts: number; answers: number }> {
  if (studentId === 'local') return { attempts: 0, answers: 0 };
  const items = await outbox.pending(studentId);
  const attempts = items.filter((i): i is Extract<OutboxItem, { kind: 'attempt' }> => i.kind === 'attempt');
  const answers = items.filter((i): i is Extract<OutboxItem, { kind: 'answer' }> => i.kind === 'answer');
  // Attempts first: mission answers reference their attempt (RLS checks it exists).
  if (attempts.length) {
    await api.saveAttempts(studentId, attempts.map((i) => i.row));
    await outbox.remove(attempts.map((i) => i.key));
  }
  if (answers.length) {
    await api.insertAnswers(studentId, answers.map((i) => i.row));
    await outbox.remove(answers.map((i) => i.key));
  }
  return { attempts: attempts.length, answers: answers.length };
}
