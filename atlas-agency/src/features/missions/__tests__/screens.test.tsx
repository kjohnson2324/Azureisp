import { act, render, screen, userEvent } from '@testing-library/react-native';

import i18n from '@/i18n';
import { PreferencesProvider } from '@/a11y/PreferencesContext';
import { countryRepository } from '@/content/countries';
import { MemoryOutbox, type EvidenceApi } from '@/offline/outbox';
import { MemoryProgressStore } from '@/offline/progress';
import { StudentProvider, type StudentSession } from '@/session/StudentContext';
import { caseFile } from '../catalog';
import { answerAt } from '../engine';
import { CaseScreen } from '../CaseScreen';
import { CasesScreen } from '../CasesScreen';

const repo = countryRepository();
const name = (iso2: string, l: 'en' | 'es' = 'en') => repo.get(iso2)!.name[l];

function setup(session: StudentSession = { gradeBand: 'K-2', studentId: 'student-1' }, prefs = {}) {
  const outbox = new MemoryOutbox();
  const progress = new MemoryProgressStore();
  const uploaded: string[] = [];
  const evidence: EvidenceApi = {
    saveAttempts: async (_s, rows) => { uploaded.push(...rows.map((r) => `attempt:${r.status}`)); },
    insertAnswers: async (_s, rows) => { uploaded.push(...rows.map((r) => `answer:${r.correct}`)); },
  };
  const load = async () => ({ outbox, progress, evidence });
  const ui = (node: React.ReactElement) => (
    <PreferencesProvider initial={prefs}><StudentProvider value={session}>{node}</StudentProvider></PreferencesProvider>
  );
  return { outbox, progress, uploaded, load, ui };
}

beforeEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('CaseScreen', () => {
  it('plays a K-2 case from briefing to solved, and uploads the evidence', async () => {
    const { load, ui, progress, uploaded } = setup();
    const m = caseFile('mission:gk2-eiffel-tower')!.mission;
    const onExit = jest.fn();
    const user = userEvent.setup();
    await render(ui(<CaseScreen missionId="mission:gk2-eiffel-tower" load={load} onExit={onExit} />));

    expect(screen.getByText(/the Eiffel Tower vanished from Paris overnight/)).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Start the case' }));
    expect(screen.getByText('📍 Paris, France')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^(?!🔊|🧭)/ }).length).toBeGreaterThan(0);

    // Stop 1: wrong first, then right.
    const wrong = m.stops[0]!.choices!.find((c) => c !== answerAt(m, 0))!;
    await user.press(screen.getByRole('button', { name: name(wrong) }));
    expect(screen.getByText(`❌ Not quite — the trail went cold in ${name(wrong)}. Try again!`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: name(wrong) })).toBeNull();
    await user.press(screen.getByRole('button', { name: name(answerAt(m, 0)!) }));
    expect(screen.getByText('✅ Correct! +5 ★')).toBeTruthy();
    expect(screen.getByText(new RegExp(`Flying to .*${name(answerAt(m, 0)!)}`))).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    // Stop 2: use a hint, then answer.
    await user.press(screen.getByRole('button', { name: /Ask Gizmo for a hint \(−2 ★\)/ }));
    expect(screen.getByText(m.stops[1]!.hint.en)).toBeTruthy();
    await user.press(screen.getByRole('button', { name: name(answerAt(m, 1)!) }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    // Warrant.
    expect(screen.getByText(`•  ${m.culpritClues[0]!.en}`)).toBeTruthy();
    await user.press(screen.getByTestId(`suspect-${m.culprit}`));
    expect(screen.getByText('🎉 Case solved!')).toBeTruthy();
    expect(screen.getByText('The Eiffel Tower is back home!')).toBeTruthy();
    expect(screen.getByLabelText('Earned this case: 43')).toBeTruthy(); // 5 + 10 − 2 + 30
    expect(screen.getByText('🛂 New passport stamp: France')).toBeTruthy();

    await act(async () => {});
    expect((await progress.solved('student-1')).get('mission:gk2-eiffel-tower')).toBe(43);
    expect(uploaded).toContain('attempt:solved');
    expect(uploaded.filter((u) => u.startsWith('answer:'))).toEqual(expect.arrayContaining(['answer:false', 'answer:true']));
    await user.press(screen.getByRole('button', { name: 'Back to case files' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('shows a map-reading travel clue and runs the adjustable timer in grades 6-8', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-23T12:00:00Z') });
    try {
      const { load, ui } = setup({ gradeBand: '6-8', studentId: 'student-2' }, { units: 'imperial', timerMultiplier: 1.5 });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await render(ui(<CaseScreen missionId="mission:g68-machu-picchu" load={load} onExit={() => {}} />));
      await user.press(screen.getByRole('button', { name: 'Start the case' }));
      expect(screen.getByText(/^The thief flew about [\d,]+ miles (north|northeast|east|southeast|south|southwest|west|northwest)\.$/)).toBeTruthy();
      // 120-second stops × the student's 1.5× timer preference.
      expect(screen.getByLabelText('180 seconds left')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(60_000); });
      expect(screen.getByLabelText('120 seconds left')).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(120_000); });
      expect(screen.getByText("Time's up! Gizmo gives you a free hint.")).toBeTruthy();
      expect(screen.getByText(caseFile('mission:g68-machu-picchu')!.mission.stops[0]!.hint.en)).toBeTruthy();
      expect(screen.getByLabelText('0 ★')).toBeTruthy(); // no charge for a timeout hint
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs untimed when the student turns timers off', async () => {
    const { load, ui } = setup({ gradeBand: '6-8', studentId: 's' }, { timerMultiplier: 0 });
    const user = userEvent.setup();
    await render(ui(<CaseScreen missionId="mission:g68-machu-picchu" load={load} onExit={() => {}} />));
    await user.press(screen.getByRole('button', { name: 'Start the case' }));
    expect(screen.queryByLabelText(/seconds left/)).toBeNull();
  });

  it('keeps evidence on the device before sign-in exists', async () => {
    const { load, ui, outbox, uploaded } = setup({ gradeBand: 'K-2' });
    const user = userEvent.setup();
    await render(ui(<CaseScreen missionId="mission:gk2-eiffel-tower" load={load} onExit={() => {}} />));
    await user.press(screen.getByRole('button', { name: 'Start the case' }));
    await act(async () => {});
    expect(uploaded).toEqual([]);
    expect(await outbox.pending('local')).toHaveLength(1);
  });

  it('plays in Spanish', async () => {
    await act(() => i18n.changeLanguage('es'));
    const { load, ui } = setup({ gradeBand: '3-5', studentId: 's' });
    const user = userEvent.setup();
    await render(ui(<CaseScreen missionId="mission:g35-taj-mahal" load={load} onExit={() => {}} />));
    expect(screen.getByText(/el Taj Mahal desapareció de Nueva Delhi/)).toBeTruthy();
    await user.press(screen.getByRole('button', { name: 'Empezar el caso' }));
    expect(screen.getByText('¿A dónde fue después?')).toBeTruthy();
    expect(screen.getByText(/^Voló hacia el (norte|noreste|este|sureste|sur|suroeste|oeste|noroeste)\.$/)).toBeTruthy();
  });
});

describe('CasesScreen', () => {
  it('lists the cases for the student’s grade band and marks solved ones', async () => {
    const { load, ui, progress } = setup({ gradeBand: '3-5', studentId: 's1' });
    await progress.markSolved('s1', 'mission:vanishing-tower', 75);
    const onOpen = jest.fn();
    const user = userEvent.setup();
    await render(ui(<CasesScreen load={load} onOpen={onOpen} />));
    const first = await screen.findByTestId('case-mission:vanishing-tower');
    expect(await screen.findByText(/✅ Solved \(75 ★\)/)).toBeTruthy();
    await user.press(first);
    expect(onOpen).toHaveBeenCalledWith('mission:vanishing-tower');
  });
});
