import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CaseFile } from './catalog';
import { newCase, step, totalPoints, type Action, type CaseState, type EngineContext } from './engine';
import { usePreferences } from '@/a11y/PreferencesContext';
import { effectiveSeconds } from '@/a11y/preferences';
import { countryRepository } from '@/content/countries';
import { flushOutbox } from '@/offline/outbox';
import type { OfflineRuntime } from '@/offline/runtime';
import { useStudent } from '@/session/StudentContext';

export type EvidenceRuntime = Pick<OfflineRuntime, 'outbox' | 'progress' | 'evidence'>;

/**
 * Runs a case: the engine decides, this hook persists. Every step's rows go to
 * the offline outbox first, then a best-effort upload (D3: teachers see answers
 * live whenever the device is online).
 */
export function useCase(file: CaseFile, load: () => Promise<EvidenceRuntime>, assignment?: { id: string; timerMultiplier?: number }) {
  const { studentId = 'local' } = useStudent();
  const { prefs } = usePreferences();
  const ctx = useMemo<EngineContext>(() => ({
    mission: file.mission,
    missionId: file.id,
    missionVersion: file.version,
    repo: countryRepository(),
    now: () => Date.now(),
    uuid: () => Crypto.randomUUID(),
    assignmentId: assignment?.id ?? null,
  }), [file, assignment?.id]);

  const [state, setState] = useState<CaseState>(() => newCase(ctx));
  const ref = useRef(state);

  const dispatch = useCallback((a: Action) => {
    const r = step(ref.current, a, ctx);
    if (r.state === ref.current) return;
    ref.current = r.state;
    setState(r.state);
    if (!r.attempt && r.answers.length === 0) return;
    void (async () => {
      const rt = await load();
      if (r.attempt) await rt.outbox.putAttempt(studentId, r.attempt);
      if (r.answers.length) await rt.outbox.addAnswers(studentId, r.answers);
      if (r.state.phase === 'solved') await rt.progress.markSolved(studentId, file.id, totalPoints(r.state));
      if (rt.evidence) await flushOutbox(rt.outbox, rt.evidence, studentId).catch(() => {}); // stays queued offline
    })();
  }, [ctx, load, studentId, file.id]);

  // Adjustable timer: mission default × student preference × assignment; 0 = untimed.
  const seconds = effectiveSeconds(file.mission.timer.secondsPerStop, prefs, assignment?.timerMultiplier ?? 1);
  const active = seconds !== null && state.phase === 'stop' && !state.timedOut;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, state.stopStartedAt]);
  const left = seconds === null || state.phase !== 'stop'
    ? null
    : state.timedOut ? 0 : Math.min(seconds, Math.max(0, Math.ceil((state.stopStartedAt + seconds * 1000 - now) / 1000)));
  useEffect(() => {
    if (active && left === 0) dispatch({ type: 'timeout' });
  }, [active, left, dispatch]);

  return { state, dispatch, secondsLeft: left, secondsTotal: seconds };
}
