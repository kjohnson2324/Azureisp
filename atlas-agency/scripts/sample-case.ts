/// <reference types="node" />
// Plays a seeded case through the real engine and prints a transcript (docs sample).
//   npx tsx scripts/sample-case.ts mission:g35-taj-mahal
import en from '../src/i18n/en.json';
import { CountryRepository } from '../src/content/countries';
import { caseFile } from '../src/features/missions/catalog';
import { answerAt, newCase, step, totalPoints, type Action, type CaseState } from '../src/features/missions/engine';
import { travel } from '../src/features/missions/travel';
import { formatDistance } from '../src/features/map/distance';
import { VILLAINS } from '../content/missions/source/villains';

const id = process.argv[2] ?? 'mission:g35-taj-mahal';
const file = caseFile(id)!;
const m = file.mission;
const repo = new CountryRepository();
const tr = (key: string, vars: Record<string, string | number> = {}) =>
  (key.split('.').reduce((o: any, k) => o[k], en) as string).replace(/{{(\w+)}}/g, (_, v) => String(vars[v]));
const c = (iso2: string) => repo.get(iso2)!;
const clue = new Map(repo.all().flatMap((x) => x.clues.map((k) => [k.id, k] as const)));
let clock = Date.parse('2026-10-23T14:00:00Z');
let n = 0;
const ctx = { mission: m, missionId: file.id, missionVersion: file.version, repo, now: () => clock, uuid: () => `uuid-${++n}` };
let s: CaseState = newCase(ctx);
const out: string[] = [];
const say = (x = '') => out.push(x);
const act = (a: Action) => { clock += 9000; const r = step(s, a, ctx); s = r.state; return r; };

say(`ATLAS AGENCY · ${m.title.en} · Grade band ${file.gradeBands.join(', ')} · Standards ${file.standardIds.join(', ')}`);
say();
say(`🦉 ${tr('case.chief')}: "${m.briefing.en}"`);
say(`   ${tr('case.suspects')}: ${m.suspects.map((v) => `${VILLAINS[v].icon} ${VILLAINS[v].name[0]}`).join(' · ')}`);
act({ type: 'begin' });
const events: string[] = [];
for (let i = 0; i < m.stops.length - 1; i++) {
  const here = c(m.stops[i]!.country);
  const next = answerAt(m, i)!;
  say();
  say(`── ${tr('case.stopOf', { n: i + 1, total: m.stops.length })} · 📍 ${here.capital.name.en}, ${here.name.en}`);
  for (const id of m.stops[i]!.clueIds) say(`   🔍 ${clue.get(id)!.text.en}`);
  const t = travel(here.capital.coord, c(next).capital.coord);
  if (m.travel !== 'none') say(`   ✈️ ${tr(`case.travel_${m.travel}`, { direction: t.direction, distance: formatDistance(t.km, 'imperial', 'en').primary })}`);
  say(`   ${tr('case.whereNext')}  ${s.remainingChoices.map((x) => `[ ${c(x).name.en} ]`).join(' ')}`);
  if (i === 1) {
    const wrong = s.remainingChoices.find((x) => x !== next)!;
    events.push(...act({ type: 'choose', iso2: wrong }).answers.map((e) => `${e.country_code} correct=${e.correct}`));
    say(`   > ${c(wrong).name.en}   ❌ ${tr('case.wrong', { country: c(wrong).name.en })}`);
    act({ type: 'hint' });
    say(`   ${tr('case.gizmo')} "${m.stops[i]!.hint.en}"  (−${m.scoring.hintCost} ★)`);
  }
  events.push(...act({ type: 'choose', iso2: next }).answers.map((e) => `${e.country_code} correct=${e.correct} hint=${e.hint_used}`));
  say(`   > ${c(next).name.en}   ✅ ${tr('case.correct', { points: s.results.at(-1)!.points })}`);
  say(`   ✈️ ${tr('case.flyingTo', { city: c(next).capital.name.en, country: c(next).name.en })} ${tr('case.flew', { distance: `${formatDistance(t.km, 'imperial', 'en').primary} (${formatDistance(t.km, 'imperial', 'en').secondary})` })}`);
  act({ type: 'continue' });
}
const last = c(m.stops.at(-1)!.country);
say();
say(`── ${tr('case.stopOf', { n: m.stops.length, total: m.stops.length })} · 📍 ${last.capital.name.en}, ${last.name.en} · ${tr('case.warrant').toUpperCase()}`);
for (const id of m.stops.at(-1)!.clueIds) say(`   🔍 ${tr('case.witness')}: ${clue.get(id)!.text.en}`);
for (const t of m.culpritClues) say(`   🗂 ${t.en}`);
say(`   ${tr('case.whoIsThief')}  ${m.suspects.map((v) => `[ ${VILLAINS[v].name[0]} ]`).join(' ')}`);
act({ type: 'accuse', suspect: m.culprit });
say(`   > ${VILLAINS[m.culprit].name[0]}   🎉 ${tr('case.solvedTitle')}`);
say();
const lm = m.landmark.name.en;
say(`   ${tr('case.returned', { landmark: lm.charAt(0).toUpperCase() + lm.slice(1) })}`);
say(`   ${tr('case.cluesLine')} ........ +${s.points.clues} ★`);
say(`   ${tr('case.hintsLine')} ................ ${s.points.hints} ★`);
say(`   ${tr('case.caseLine')} .......... +${s.points.caseSolved} ★`);
say(`   ${tr('case.total')} ...... ${totalPoints(s)} ★`);
say(`   🛂 ${tr('case.stamp', { country: c(m.stamp.slice(6)).name.en })}`);
say();
say(`Answer events queued for sync (and the teacher's live feed): ${events.join(' · ')}`);
console.log(out.join('\n'));
