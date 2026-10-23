// The case engine: a pure reducer. Each action returns the next state plus the
// rows to sync (mission attempt + answer events). Grading happens here, on the
// device (D3), so cases play fully offline; the server only stores evidence and
// derives points/mastery from it (step 5).
//
// Flow: briefing → stop (pick where the thief went) → travel → … → warrant (name the thief) → solved
import type { CountryRepository } from '@/content/countries';
import type { ClueSkill, Mission } from '@/content/schemas';
import type { VillainId } from '../../../content/missions/source/villains';

export type Phase = 'briefing' | 'stop' | 'travel' | 'warrant' | 'solved';

export type Feedback =
  | { kind: 'correct'; iso2: string }
  | { kind: 'wrong'; iso2: string }
  | { kind: 'hint' }
  | { kind: 'timeout' }
  | { kind: 'wrongSuspect'; suspect: VillainId };

export interface StopResult {
  answer: string;
  wrongPicks: string[];
  hintUsed: boolean;
  timedOut: boolean;
  points: number;
}

export interface CaseState {
  attemptId: string;
  missionId: string;
  missionVersion: number;
  phase: Phase;
  stopIndex: number;
  remainingChoices: string[];
  hintShown: boolean;
  hintPaid: boolean;
  timedOut: boolean;
  wrongPicks: string[];
  remainingSuspects: VillainId[];
  wrongSuspects: VillainId[];
  results: StopResult[];
  startedAt: number;
  stopStartedAt: number;
  completedAt?: number;
  points: { clues: number; hints: number; caseSolved: number };
  feedback?: Feedback;
}

export type Action =
  | { type: 'begin' }
  | { type: 'choose'; iso2: string }
  | { type: 'hint' }
  | { type: 'timeout' }
  | { type: 'continue' }
  | { type: 'accuse'; suspect: VillainId };

/** Matches public.answer_events (student_id is added at sync time from the session). */
export interface AnswerEventRow {
  id: string;
  context: 'mission';
  context_id: string;
  item_id: string;
  item_version: number;
  skill: ClueSkill | 'location';
  country_code: string;
  correct: boolean;
  hint_used: boolean;
  response: { choice: string; stop: number };
  duration_ms: number;
  occurred_at: string;
}

/** Matches the client-writable columns of public.mission_attempts. */
export interface AttemptRow {
  id: string;
  mission_id: string;
  mission_version: number;
  assignment_id: string | null;
  status: 'in_progress' | 'solved' | 'abandoned';
  current_stop: number;
  hints_used: number;
  started_at: string;
  completed_at: string | null;
  client_updated_at: string;
}

export interface EngineContext {
  mission: Mission;
  missionId: string;
  missionVersion: number;
  repo: CountryRepository;
  now: () => number;
  uuid: () => string;
  assignmentId?: string | null;
}

export interface StepResult {
  state: CaseState;
  answers: AnswerEventRow[];
  attempt?: AttemptRow;
}

const iso = (ms: number) => new Date(ms).toISOString();
const finalStop = (m: Mission) => m.stops.length - 1;
export const answerAt = (m: Mission, i: number) => m.stops[i + 1]?.country;

export function newCase(ctx: EngineContext): CaseState {
  const t = ctx.now();
  return {
    attemptId: ctx.uuid(),
    missionId: ctx.missionId,
    missionVersion: ctx.missionVersion,
    phase: 'briefing',
    stopIndex: 0,
    remainingChoices: [...(ctx.mission.stops[0]?.choices ?? [])],
    hintShown: false,
    hintPaid: false,
    timedOut: false,
    wrongPicks: [],
    remainingSuspects: [...ctx.mission.suspects],
    wrongSuspects: [],
    results: [],
    startedAt: t,
    stopStartedAt: t,
    points: { clues: 0, hints: 0, caseSolved: 0 },
  };
}

export const totalPoints = (s: CaseState) => s.points.clues + s.points.hints + s.points.caseSolved;
export const hintsUsed = (s: CaseState) => s.results.filter((r) => r.hintUsed).length + (s.hintPaid ? 1 : 0);

/** Points for a stop: full on the first try, half after a wrong pick. */
export function stopPoints(mission: Mission, wrongPicks: number): number {
  return wrongPicks === 0 ? mission.scoring.clueSolved : Math.ceil(mission.scoring.clueSolved / 2);
}

function attemptRow(s: CaseState, ctx: EngineContext): AttemptRow {
  const t = ctx.now();
  return {
    id: s.attemptId,
    mission_id: s.missionId,
    mission_version: s.missionVersion,
    assignment_id: ctx.assignmentId ?? null,
    status: s.phase === 'solved' ? 'solved' : 'in_progress',
    current_stop: s.stopIndex,
    hints_used: hintsUsed(s),
    started_at: iso(s.startedAt),
    completed_at: s.completedAt ? iso(s.completedAt) : null,
    client_updated_at: iso(t),
  };
}

export function step(s: CaseState, a: Action, ctx: EngineContext): StepResult {
  const m = ctx.mission;
  const t = ctx.now();
  const unchanged = { state: s, answers: [] };

  switch (a.type) {
    case 'begin': {
      if (s.phase !== 'briefing') return unchanged;
      const state: CaseState = { ...s, phase: 'stop', stopStartedAt: t, feedback: undefined };
      return { state, answers: [], attempt: attemptRow(state, ctx) };
    }

    case 'hint': {
      if (s.phase !== 'stop' && s.phase !== 'warrant') return unchanged;
      if (s.hintShown) return unchanged;
      return {
        state: { ...s, hintShown: true, hintPaid: true, feedback: { kind: 'hint' }, points: { ...s.points, hints: s.points.hints - m.scoring.hintCost } },
        answers: [],
      };
    }

    case 'timeout': {
      // Running out of time never fails a case: the hint appears for free.
      if (s.phase !== 'stop' || s.timedOut) return unchanged;
      return { state: { ...s, timedOut: true, hintShown: true, feedback: { kind: 'timeout' } }, answers: [] };
    }

    case 'choose': {
      if (s.phase !== 'stop' || !s.remainingChoices.includes(a.iso2)) return unchanged;
      const answer = answerAt(m, s.stopIndex)!;
      const correct = a.iso2 === answer;
      const firstClue = m.stops[s.stopIndex]!.clueIds[0] ?? '';
      const skill = (firstClue.split('-')[1] ?? 'location') as ClueSkill;
      const answers: AnswerEventRow[] = [{
        id: ctx.uuid(),
        context: 'mission',
        context_id: s.attemptId,
        item_id: `country:${answer}`,
        item_version: ctx.repo.version(answer) ?? 1,
        skill,
        country_code: answer,
        correct,
        hint_used: s.hintShown,
        response: { choice: a.iso2, stop: s.stopIndex },
        duration_ms: Math.max(0, Math.min(3_600_000, t - s.stopStartedAt)),
        occurred_at: iso(t),
      }];
      if (!correct) {
        return {
          state: { ...s, wrongPicks: [...s.wrongPicks, a.iso2], remainingChoices: s.remainingChoices.filter((c) => c !== a.iso2), feedback: { kind: 'wrong', iso2: a.iso2 } },
          answers,
        };
      }
      const points = stopPoints(m, s.wrongPicks.length);
      const result: StopResult = { answer, wrongPicks: s.wrongPicks, hintUsed: s.hintPaid, timedOut: s.timedOut, points };
      const state: CaseState = {
        ...s,
        phase: 'travel',
        results: [...s.results, result],
        points: { ...s.points, clues: s.points.clues + points },
        feedback: { kind: 'correct', iso2: answer },
        hintPaid: false,
      };
      return { state, answers, attempt: attemptRow(state, ctx) };
    }

    case 'continue': {
      if (s.phase !== 'travel') return unchanged;
      const next = s.stopIndex + 1;
      const atEnd = next === finalStop(m);
      const state: CaseState = {
        ...s,
        stopIndex: next,
        phase: atEnd ? 'warrant' : 'stop',
        remainingChoices: [...(m.stops[next]?.choices ?? [])],
        hintShown: false,
        hintPaid: false,
        timedOut: false,
        wrongPicks: [],
        stopStartedAt: t,
        feedback: undefined,
      };
      return { state, answers: [], attempt: attemptRow(state, ctx) };
    }

    case 'accuse': {
      if (s.phase !== 'warrant' || !s.remainingSuspects.includes(a.suspect)) return unchanged;
      if (a.suspect !== m.culprit) {
        return {
          state: { ...s, wrongSuspects: [...s.wrongSuspects, a.suspect], remainingSuspects: s.remainingSuspects.filter((x) => x !== a.suspect), feedback: { kind: 'wrongSuspect', suspect: a.suspect } },
          answers: [],
        };
      }
      const state: CaseState = {
        ...s,
        phase: 'solved',
        completedAt: t,
        points: { ...s.points, caseSolved: m.scoring.caseSolved },
        feedback: undefined,
      };
      return { state, answers: [], attempt: attemptRow(state, ctx) };
    }
  }
}
