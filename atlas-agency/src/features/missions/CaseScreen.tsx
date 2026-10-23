import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { caseFile, type CaseFile } from './catalog';
import { answerAt, totalPoints, type CaseState } from './engine';
import { COMPASS_ES, travel } from './travel';
import { useCase, type EvidenceRuntime } from './useCase';
import { VILLAINS, type VillainId } from '../../../content/missions/source/villains';
import { usePreferences, useAppTheme, useUnits } from '@/a11y/PreferencesContext';
import { speakAll } from '@/a11y/speech';
import { countryRepository, pick, type Locale } from '@/content/countries';
import { FLAG_ASSETS } from '@/content/flagAssets';
import type { Clue } from '@/content/schemas';
import { formatDistance } from '@/features/map/distance';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

const SKILL_ICON: Record<string, string> = { flag: '🏳️', landmark: '🏛️', language: '💬', currency: '💰', food: '🍲', animal: '🐾', travel: '✈️' };

interface Props {
  missionId: string;
  load: () => Promise<EvidenceRuntime>;
  onExit: () => void;
}

export function CaseScreen({ missionId, load, onExit }: Props) {
  const { t } = useTranslation();
  const file = caseFile(missionId);
  if (!file) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppText>{t('case.notFound')}</AppText>
        <Button label={t('case.backToCases')} onPress={onExit} />
      </SafeAreaView>
    );
  }
  return <CasePlayer file={file} load={load} onExit={onExit} />;
}

function CasePlayer({ file, load, onExit }: { file: CaseFile; load: Props['load']; onExit: () => void }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'es' ? 'es' : 'en';
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const units = useUnits();
  const repo = countryRepository();
  const m = file.mission;
  const { state: s, dispatch, secondsLeft, secondsTotal } = useCase(file, load);

  const country = (iso2: string) => repo.get(iso2)!;
  const here = country(m.stops[s.stopIndex]!.country);
  const clueIndex = new Map(repo.all().flatMap((c) => c.clues.map((k) => [k.id, k] as const)));
  const clues = m.stops[s.stopIndex]!.clueIds.map((id) => clueIndex.get(id)).filter((k): k is Clue => !!k);
  const villainName = (v: VillainId) => pick({ en: VILLAINS[v].name[0], es: VILLAINS[v].name[1] }, locale);

  // Travel clue: which way (and how far) from this stop's capital to the next one.
  const next = answerAt(m, s.stopIndex);
  const travelLine = (() => {
    if (m.travel === 'none' || !next || s.phase !== 'stop') return undefined;
    const tr = travel(here.capital.coord, country(next).capital.coord);
    const direction = locale === 'es' ? COMPASS_ES[tr.direction] : tr.direction;
    return t(`case.travel_${m.travel}`, { direction, distance: formatDistance(tr.km, units, locale).primary });
  })();

  const speakable = phaseText(s, { t, locale, m, here, clues, travelLine, villainName });
  useEffect(() => {
    if (prefs.readAloud) void speakAll(speakable, locale, prefs);
    // Read each new screen once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.stopIndex]);

  const header = (
    <View style={styles.header}>
      <AppText variant="caption" muted style={{ flex: 1 }}>{pick(m.title, locale)}</AppText>
      <AppText variant="heading" accessibilityLabel={t('case.points', { points: totalPoints(s) })}>{t('case.points', { points: totalPoints(s) })}</AppText>
      <Button label={t('case.readAloud')} icon="🔊" onPress={() => speakAll(speakable, locale, prefs)} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}

        {s.phase === 'briefing' ? (
          <>
            <AppText variant="title" accessibilityRole="header">{`🦉 ${t('case.chief')}`}</AppText>
            <AppText>{pick(m.briefing, locale)}</AppText>
            <AppText variant="heading">{t('case.suspects')}</AppText>
            <AppText>{m.suspects.map((v) => `${VILLAINS[v].icon} ${villainName(v)}`).join('  ·  ')}</AppText>
            <Button kind="primary" label={t('case.startCase')} onPress={() => dispatch({ type: 'begin' })} testID="start-case" />
          </>
        ) : null}

        {s.phase === 'stop' || s.phase === 'warrant' ? (
          <>
            <AppText variant="caption" muted>{t('case.stopOf', { n: s.stopIndex + 1, total: m.stops.length })}</AppText>
            <AppText variant="title" accessibilityRole="header">{`📍 ${pick(here.capital.name, locale)}, ${pick(here.name, locale)}`}</AppText>
            {secondsLeft !== null && secondsTotal ? <TimerBar left={secondsLeft} total={secondsTotal} label={t('case.timeLeft', { seconds: secondsLeft })} /> : null}
            {clues.map((k) => (
              <ClueCard key={k.id} icon={SKILL_ICON[k.skill]!} label={s.phase === 'warrant' ? t('case.witness') : t(`case.skill_${k.skill}`)} text={pick(k.text, locale)} />
            ))}
            {travelLine ? <ClueCard icon={SKILL_ICON.travel!} label={t('case.skill_travel')} text={travelLine} /> : null}
          </>
        ) : null}

        {s.phase === 'stop' ? (
          <>
            <AppText variant="heading" accessibilityRole="header">{t('case.whereNext')}</AppText>
            <View style={styles.choices}>
              {s.remainingChoices.map((iso2) => (
                <ChoiceButton key={iso2} iso2={iso2} name={pick(country(iso2).name, locale)} onPress={() => dispatch({ type: 'choose', iso2 })} />
              ))}
            </View>
          </>
        ) : null}

        {s.phase === 'warrant' ? (
          <>
            <AppText variant="heading" accessibilityRole="header">{`🗂 ${t('case.dossier')}`}</AppText>
            {m.culpritClues.map((c) => <AppText key={c.en}>{`•  ${pick(c, locale)}`}</AppText>)}
            <AppText variant="heading" accessibilityRole="header">{t('case.whoIsThief')}</AppText>
            <View style={styles.choices}>
              {s.remainingSuspects.map((v) => (
                <Button key={v} label={`${VILLAINS[v].icon} ${villainName(v)}`} onPress={() => dispatch({ type: 'accuse', suspect: v })} testID={`suspect-${v}`} />
              ))}
            </View>
          </>
        ) : null}

        {(s.phase === 'stop' || s.phase === 'warrant') && !s.hintShown ? (
          <Button label={t('case.hint', { cost: m.scoring.hintCost })} icon="🧭" onPress={() => dispatch({ type: 'hint' })} testID="hint" />
        ) : null}
        {s.hintShown && (s.phase === 'stop' || s.phase === 'warrant') ? (
          <View style={[styles.hint, { borderColor: colors.accent }]} accessible accessibilityLiveRegion="polite">
            {s.timedOut ? <AppText variant="caption">{t('case.timeUp')}</AppText> : null}
            <AppText variant="caption" muted>{t('case.gizmo')}</AppText>
            <AppText>{pick(m.stops[s.stopIndex]!.hint, locale)}</AppText>
          </View>
        ) : null}

        <Feedback s={s} locale={locale} villainName={villainName} />

        {s.phase === 'travel' ? (
          <TravelCard s={s} file={file} locale={locale} units={units} onContinue={() => dispatch({ type: 'continue' })} />
        ) : null}

        {s.phase === 'solved' ? <SolvedCard s={s} file={file} locale={locale} onExit={onExit} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function phaseText(
  s: CaseState,
  o: { t: TFunction; locale: Locale; m: CaseFile['mission']; here: { name: { en: string; es: string } }; clues: Clue[]; travelLine?: string; villainName: (v: VillainId) => string },
): string[] {
  const { t, locale, m } = o;
  if (s.phase === 'briefing') return [pick(m.briefing, locale)];
  if (s.phase === 'stop') return [...o.clues.map((k) => pick(k.text, locale)), ...(o.travelLine ? [o.travelLine] : []), t('case.whereNext')];
  if (s.phase === 'warrant') return [...o.clues.map((k) => pick(k.text, locale)), ...m.culpritClues.map((c) => pick(c, locale)), t('case.whoIsThief')];
  if (s.phase === 'solved') return [t('case.solvedTitle')];
  return [];
}

function ClueCard({ icon, label, text }: { icon: string; label: string; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.clue, { borderColor: colors.text, backgroundColor: colors.surface }]} accessible accessibilityLabel={`${label}: ${text}`}>
      <AppText variant="caption" muted>{`${icon}  ${label}`}</AppText>
      <AppText>{text}</AppText>
    </View>
  );
}

function ChoiceButton({ iso2, name, onPress }: { iso2: string; name: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.choice}>
      <Image source={FLAG_ASSETS[iso2]} style={[styles.choiceFlag, { borderColor: colors.text }]} contentFit="contain" accessible={false} />
      <Button label={name} onPress={onPress} style={{ flex: 1 }} testID={`choice-${iso2}`} />
    </View>
  );
}

function TimerBar({ left, total, label }: { left: number; total: number; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: total, now: left }}>
      <View style={[styles.track, { borderColor: colors.text }]}>
        <View style={[styles.fill, { width: `${(left / total) * 100}%`, backgroundColor: colors.accent }]} />
      </View>
      <AppText variant="caption" muted>{label}</AppText>
    </View>
  );
}

function Feedback({ s, locale, villainName }: { s: CaseState; locale: Locale; villainName: (v: VillainId) => string }) {
  const { t } = useTranslation();
  const repo = countryRepository();
  const f = s.feedback;
  if (!f || f.kind === 'hint' || f.kind === 'timeout') return null;
  const text =
    f.kind === 'wrong' ? `❌ ${t('case.wrong', { country: pick(repo.get(f.iso2)!.name, locale) })}`
    : f.kind === 'wrongSuspect' ? `🙅 ${t('case.wrongSuspect', { name: villainName(f.suspect) })}`
    : `✅ ${t('case.correct', { points: s.results.at(-1)?.points ?? 0 })}`;
  return (
    <AppText accessibilityLiveRegion="assertive" testID="feedback">
      {text}
    </AppText>
  );
}

function TravelCard({ s, file, locale, units, onContinue }: { s: CaseState; file: CaseFile; locale: Locale; units: 'imperial' | 'metric'; onContinue: () => void }) {
  const { t } = useTranslation();
  const repo = countryRepository();
  const from = repo.get(file.mission.stops[s.stopIndex]!.country)!;
  const to = repo.get(file.mission.stops[s.stopIndex + 1]!.country)!;
  const km = travel(from.capital.coord, to.capital.coord).km;
  return (
    <View style={styles.travel} testID="travel">
      <AppText variant="heading">{`✈️ ${t('case.flyingTo', { city: pick(to.capital.name, locale), country: pick(to.name, locale) })}`}</AppText>
      <AppText>{t('case.flew', { distance: `${formatDistance(km, units, locale).primary} (${formatDistance(km, units, locale).secondary})` })}</AppText>
      <Button kind="primary" label={t('case.continue')} onPress={onContinue} testID="continue" />
    </View>
  );
}

function SolvedCard({ s, file, locale, onExit }: { s: CaseState; file: CaseFile; locale: Locale; onExit: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const repo = countryRepository();
  const landmark = pick(file.mission.landmark.name, locale);
  const stampCountry = repo.get(file.mission.stamp.slice(6))!;
  const row = (label: string, value: number) => (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <AppText>{`${value > 0 ? '+' : ''}${value} ★`}</AppText>
    </View>
  );
  return (
    <View style={[styles.solved, { borderColor: colors.text }]} testID="solved">
      <AppText variant="title" accessibilityRole="header">{`🎉 ${t('case.solvedTitle')}`}</AppText>
      <AppText variant="heading">{t('case.returned', { landmark: landmark.charAt(0).toUpperCase() + landmark.slice(1) })}</AppText>
      {row(t('case.cluesLine'), s.points.clues)}
      {s.points.hints !== 0 ? row(t('case.hintsLine'), s.points.hints) : null}
      {row(t('case.caseLine'), s.points.caseSolved)}
      {row(t('case.total'), totalPoints(s))}
      <AppText>{`🛂 ${t('case.stamp', { country: pick(stampCountry.name, locale) })}`}</AppText>
      <AppText variant="caption" muted>{t('case.syncNote')}</AppText>
      <Button kind="primary" label={t('case.backToCases')} onPress={onExit} testID="back-to-cases" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.space(4), gap: layout.space(3) },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space(2) },
  clue: { borderWidth: 2, borderRadius: layout.radius, padding: layout.space(3), gap: 2 },
  choices: { gap: layout.space(2) },
  choice: { flexDirection: 'row', alignItems: 'center', gap: layout.space(2) },
  choiceFlag: { width: 56, height: 42, borderWidth: 1, borderRadius: 4 },
  hint: { borderWidth: 2, borderStyle: 'dashed', borderRadius: layout.radius, padding: layout.space(3), gap: 2 },
  track: { height: 12, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  travel: { gap: layout.space(3) },
  solved: { borderWidth: 2, borderRadius: layout.radius, padding: layout.space(4), gap: layout.space(2) },
  row: { flexDirection: 'row', alignItems: 'center' },
});
