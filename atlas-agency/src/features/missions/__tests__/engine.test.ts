import missions from '../../../../content/missions/dist/missions.json';
import { CountryRepository } from '@/content/countries';
import { Mission, type GradeBand } from '@/content/schemas';
import { MemoryOutbox, flushOutbox, type EvidenceApi } from '@/offline/outbox';
import { answerAt, newCase, step, totalPoints, type Action, type CaseState, type EngineContext } from '../engine';
import { countryPool, generateMission } from '../generator';
import { BAND_RULES, FAMILIAR_COUNTRIES } from '../rules';
import { compassDirection } from '../travel';
import { LANDMARKS } from '../../../../content/missions/source/landmarks';

const repo = new CountryRepository();
const byId = (id: string) => missions.find((m) => m.id === id)!;

function ctxFor(id: string, start = 1_000_000) {
  const env = byId(id);
  let clock = start;
  let n = 0;
  const ctx: EngineContext = {
    mission: Mission.parse(env.data),
    missionId: env.id,
    missionVersion: env.version,
    repo,
    now: () => clock,
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  };
  return { ctx, tick: (ms: number) => { clock += ms; } };
}

function run(ctx: EngineContext, actions: Action[], s = newCase(ctx)) {
  const answers = [];
  const attempts = [];
  for (const a of actions) {
    const r = step(s, a, ctx);
    s = r.state;
    answers.push(...r.answers);
    if (r.attempt) attempts.push(r.attempt);
  }
  return { s, answers, attempts };
}

/** Play perfectly: correct pick at every stop, then the right suspect. */
function perfect(ctx: EngineContext): Action[] {
  const m = ctx.mission;
  const out: Action[] = [{ type: 'begin' }];
  for (let i = 0; i < m.stops.length - 1; i++) out.push({ type: 'choose', iso2: answerAt(m, i)! }, { type: 'continue' });
  out.push({ type: 'accuse', suspect: m.culprit });
  return out;
}

describe('case engine', () => {
  it('plays a perfect K-2 case for full points', () => {
    const { ctx } = ctxFor('mission:gk2-eiffel-tower');
    const { s, answers, attempts } = run(ctx, perfect(ctx));
    expect(s.phase).toBe('solved');
    expect(s.results.every((r) => r.wrongPicks.length === 0)).toBe(true);
    expect(totalPoints(s)).toBe(2 * 10 + 30);
    expect(answers).toHaveLength(2);
    expect(answers.every((a) => a.correct && a.context === 'mission' && a.context_id === s.attemptId)).toBe(true);
    expect(attempts.at(-1)).toMatchObject({ status: 'solved', mission_id: 'mission:gk2-eiffel-tower', hints_used: 0 });
  });

  it('records wrong picks, removes them, and gives half points for that stop', () => {
    const { ctx } = ctxFor('mission:g35-taj-mahal');
    const m = ctx.mission;
    const wrong = m.stops[0]!.choices!.find((c) => c !== answerAt(m, 0))!;
    const { s, answers } = run(ctx, [{ type: 'begin' }, { type: 'choose', iso2: wrong }]);
    expect(s.remainingChoices).not.toContain(wrong);
    expect(s.feedback).toEqual({ kind: 'wrong', iso2: wrong });
    expect(answers[0]).toMatchObject({ correct: false, country_code: answerAt(m, 0), response: { choice: wrong, stop: 0 } });
    const after = run(ctx, [{ type: 'choose', iso2: answerAt(m, 0)! }], s).s;
    expect(after.results[0]!.points).toBe(5);
    // Picking the same wrong country again is impossible.
    expect(step(s, { type: 'choose', iso2: wrong }, ctx).state).toBe(s);
  });

  it('charges for a hint once per stop and marks the answer as hinted', () => {
    const { ctx } = ctxFor('mission:g35-taj-mahal');
    const { s, answers } = run(ctx, [{ type: 'begin' }, { type: 'hint' }, { type: 'hint' }, { type: 'choose', iso2: answerAt(ctx.mission, 0)! }]);
    expect(s.points.hints).toBe(-5);
    expect(answers[0]!.hint_used).toBe(true);
    expect(s.results[0]!.hintUsed).toBe(true);
  });

  it('never fails on a timeout: the hint appears for free', () => {
    const { ctx } = ctxFor('mission:g68-machu-picchu');
    const { s } = run(ctx, [{ type: 'begin' }, { type: 'timeout' }]);
    expect(s.hintShown).toBe(true);
    expect(s.points.hints).toBe(0);
    expect(s.feedback).toEqual({ kind: 'timeout' });
  });

  it('measures time per stop', () => {
    const { ctx, tick } = ctxFor('mission:g35-taj-mahal');
    let s = run(ctx, [{ type: 'begin' }]).s;
    tick(12_345);
    const r = step(s, { type: 'choose', iso2: answerAt(ctx.mission, 0)! }, ctx);
    expect(r.answers[0]!.duration_ms).toBe(12_345);
    s = r.state;
  });

  it('eliminates a wrong suspect without a penalty', () => {
    const { ctx } = ctxFor('mission:g68-machu-picchu');
    const actions = perfect(ctx);
    const wrong = ctx.mission.suspects.find((x) => x !== ctx.mission.culprit)!;
    actions.splice(actions.length - 1, 0, { type: 'accuse', suspect: wrong });
    const { s } = run(ctx, actions);
    expect(s.phase).toBe('solved');
    expect(s.wrongSuspects).toEqual([wrong]);
    expect(totalPoints(s)).toBe(4 * 15 + 75);
  });

  it('ignores actions that do not fit the current phase', () => {
    const { ctx } = ctxFor('mission:gk2-eiffel-tower');
    const s: CaseState = newCase(ctx);
    for (const a of [{ type: 'choose', iso2: 'FR' }, { type: 'continue' }, { type: 'accuse', suspect: 'dot-dash' }] as Action[]) {
      expect(step(s, a, ctx).state).toBe(s);
    }
  });

  it('plays every one of the 121 seeded cases to the end', () => {
    for (const env of missions) {
      const { ctx } = ctxFor(env.id);
      expect(run(ctx, perfect(ctx)).s.phase).toBe('solved');
    }
  });
});

describe('generator', () => {
  const countries = repo.all();

  it('is deterministic', () => {
    expect(generateMission(LANDMARKS[0]!, '3-5', countries)).toEqual(generateMission(LANDMARKS[0]!, '3-5', countries));
  });

  it.each(['K-2', '3-5', '6-8'] as GradeBand[])('follows the %s rules', (band) => {
    const rules = BAND_RULES[band];
    for (const env of missions.filter((m) => m.grade_bands[0] === band && m.id.startsWith('mission:g'))) {
      const d = Mission.parse(env.data);
      expect(d.stops).toHaveLength(rules.stops);
      expect(d.suspects).toHaveLength(rules.suspects);
      expect(d.culpritClues).toHaveLength(rules.culpritClues);
      for (const s of d.stops.slice(0, -1)) expect(s.choices).toHaveLength(rules.choices);
      expect(d.travel).toBe(rules.travel);
    }
  });

  it('keeps K-2 to familiar countries with concrete clues', () => {
    const familiar = new Set<string>(FAMILIAR_COUNTRIES);
    for (const env of missions.filter((m) => m.grade_bands[0] === 'K-2')) {
      const d = Mission.parse(env.data);
      for (const s of d.stops.slice(1)) expect(familiar.has(s.country)).toBe(true);
      for (const s of d.stops.slice(0, -1)) for (const id of s.clueIds) expect(id).toMatch(/-(flag|animal)-1$/);
    }
    expect(countryPool('6-8', countries)).toHaveLength(195);
  });
});

describe('travel clues', () => {
  it('reads directions the way they look on the map', () => {
    expect(compassDirection([-99.13, 19.43], [-3.7, 40.42])).toBe('east'); // Mexico City → Madrid
    expect(compassDirection([139.69, 35.69], [-0.13, 51.51])).toBe('west'); // Tokyo → London
    expect(compassDirection([178.44, -18.14], [-171.75, -13.83])).toBe('northeast'); // Suva → Apia across 180°: 25° above east
    expect(compassDirection([18.42, -33.92], [31.24, 30.04])).toBe('north'); // Cape Town → Cairo
  });
});

describe('outbox', () => {
  it('uploads only the signed-in student’s evidence, attempts first, and empties the queue', async () => {
    const { ctx } = ctxFor('mission:gk2-eiffel-tower');
    const { answers, attempts } = run(ctx, perfect(ctx));
    const outbox = new MemoryOutbox();
    await outbox.putAttempt('student-a', attempts.at(-1)!);
    await outbox.addAnswers('student-a', answers);
    await outbox.addAnswers('student-b', [{ ...answers[0]!, id: 'other' }]);
    const calls: string[] = [];
    const api: EvidenceApi = {
      saveAttempts: async (sid, rows) => { calls.push(`attempts:${sid}:${rows.length}`); },
      insertAnswers: async (sid, rows) => { calls.push(`answers:${sid}:${rows.length}`); },
    };
    expect(await flushOutbox(outbox, api, 'student-a')).toEqual({ attempts: 1, answers: 2 });
    expect(calls).toEqual(['attempts:student-a:1', 'answers:student-a:2']);
    expect(await outbox.pending('student-a')).toEqual([]);
    expect(await outbox.pending('student-b')).toHaveLength(1);
  });

  it('keeps evidence when the upload fails, and never uploads pre-sign-in "local" rows', async () => {
    const outbox = new MemoryOutbox();
    const { ctx } = ctxFor('mission:gk2-eiffel-tower');
    const { attempts } = run(ctx, perfect(ctx));
    await outbox.putAttempt('student-a', attempts.at(-1)!);
    const failing: EvidenceApi = { saveAttempts: async () => { throw new Error('offline'); }, insertAnswers: async () => {} };
    await expect(flushOutbox(outbox, failing, 'student-a')).rejects.toThrow('offline');
    expect(await outbox.pending('student-a')).toHaveLength(1);
    expect(await flushOutbox(outbox, failing, 'local')).toEqual({ attempts: 0, answers: 0 });
  });
});
