import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import {
  compareToSchoolTrips, distanceKm, formatDistance, formatNumber, fromUnit, nearestChoice, SCHOOL_TRIP_CHOICES, type Units,
} from './distance';
import { placePoint, pointLabel, searchPlaces, type MeasurePoint } from './measure';
import { usePreferences, useAppTheme, useUnits } from '@/a11y/PreferencesContext';
import { speakAll } from '@/a11y/speech';
import { countryRepository, type Locale } from '@/content/countries';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

interface Props {
  locale: Locale;
  from?: MeasurePoint;
  to?: MeasurePoint;
  onChange: (from: MeasurePoint | undefined, to: MeasurePoint | undefined) => void;
  onDone: () => void;
}

/** How far apart two places are, and how many school-to-home round trips that equals. */
export function MeasurePanel({ locale, from, to, onChange, onDone }: Props) {
  const { t } = useTranslation();
  const { prefs, update } = usePreferences();
  const { colors } = useAppTheme();
  const units = useUnits();
  const repo = countryRepository();
  const label = (p: MeasurePoint) => pointLabel(p, locale, repo, t);

  const result = useMemo(() => {
    if (!from || !to) return undefined;
    const km = distanceKm(from.coord, to.coord);
    const unitLabel = (v: number, u: Units) => (u === 'metric' ? `${formatNumber(v, locale)} km` : `${formatNumber(v, locale)} ${locale === 'es' ? (v === 1 ? 'milla' : 'millas') : v === 1 ? 'mile' : 'miles'}`);
    // Count with exactly the distance the student sees ("about 1 mile"), not a hidden km value.
    const tripChoice = nearestChoice(prefs.schoolTripKm, units);
    const trips = compareToSchoolTrips(km, fromUnit(tripChoice, units), locale);
    return {
      distance: formatDistance(km, units, locale),
      trips: t(`measure.trips_${trips.kind}`, { count: trips.count }),
      assumption: t('measure.tripAssumption', { trip: unitLabel(tripChoice, units) }),
    };
  }, [from, to, units, locale, prefs.schoolTripKm, t]);

  const speakResult = () => {
    if (!from || !to || !result) return;
    void speakAll(
      [t('measure.a11yResult', { from: label(from), to: label(to), distance: `${result.distance.primary}, ${result.distance.secondary}` }), result.trips, result.assumption],
      locale,
      prefs,
    );
  };

  return (
    <View testID="measure-panel" style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.text }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{`📏 ${t('measure.measure')}`}</AppText>
          <Button label={t('measure.done')} onPress={onDone} testID="measure-done" />
        </View>
        {!from || !to ? <AppText variant="caption" muted>{t('measure.measureHint')}</AppText> : null}

        <Endpoint title={t('measure.from')} marker="A" point={from} label={from ? label(from) : undefined} locale={locale}
          onPick={(p) => onChange(p, to)} onClear={() => onChange(undefined, to)} />
        <Endpoint title={t('measure.to')} marker="B" point={to} label={to ? label(to) : undefined} locale={locale}
          onPick={(p) => onChange(from, p)} onClear={() => onChange(from, undefined)} />

        {result ? (
          <View accessible accessibilityLiveRegion="polite" style={[styles.result, { borderColor: colors.accent }]} testID="measure-result">
            <AppText variant="caption" muted>{t('measure.distance')}</AppText>
            <AppText variant="title">{result.distance.primary}</AppText>
            <AppText muted>{result.distance.secondary}</AppText>
            <AppText variant="heading" style={styles.trips}>{`🏫 ↔ 🏠  ${result.trips}`}</AppText>
            <AppText variant="caption" muted>{result.assumption}</AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          {result ? <Button label={t('map.readAloud')} icon="📖" onPress={speakResult} /> : null}
          {from && to ? <Button label={t('measure.swap')} icon="⇄" onPress={() => onChange(to, from)} /> : null}
          {from || to ? <Button label={t('measure.clear')} onPress={() => onChange(undefined, undefined)} /> : null}
        </View>

        <View style={styles.settings}>
          <AppText variant="heading">{t('measure.schoolTrip')}</AppText>
          <AppText variant="caption" muted>{t('measure.schoolTripHint')}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {SCHOOL_TRIP_CHOICES[units].map((v) => (
              <Chip key={v} selected={nearestChoice(prefs.schoolTripKm, units) === v}
                label={units === 'metric' ? `${formatNumber(v, locale)} km` : `${formatNumber(v, locale)} mi`}
                onPress={() => update({ schoolTripKm: fromUnit(v, units) })} />
            ))}
          </View>
          <View style={styles.chips} accessibilityRole="radiogroup">
            <Chip selected={units === 'imperial'} label={locale === 'es' ? 'Millas' : 'Miles'} onPress={() => update({ units: 'imperial' })} />
            <Chip selected={units === 'metric'} label={locale === 'es' ? 'Kilómetros' : 'Kilometers'} onPress={() => update({ units: 'metric' })} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Endpoint({ title, marker, point, label, locale, onPick, onClear }: {
  title: string; marker: string; point?: MeasurePoint; label?: string; locale: Locale;
  onPick: (p: MeasurePoint) => void; onClear: () => void;
}) {
  const { t } = useTranslation();
  const { colors, font, scale } = useAppTheme();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchPlaces(query, locale, countryRepository()), [query, locale]);

  if (point && label) {
    return (
      <View style={styles.row}>
        <AppText style={{ flex: 1 }} accessibilityLabel={`${title}: ${label}`}>{`${marker} · ${title}: ${label}`}</AppText>
        <Button label={t('measure.change')} accessibilityHint={title} onPress={onClear} />
      </View>
    );
  }
  return (
    <View style={styles.endpoint}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`${marker} · ${title}: ${t('measure.pickPlace')}`}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={`${title}: ${t('measure.pickPlace')}`}
        autoCorrect={false}
        style={[styles.search, { borderColor: colors.text, color: colors.text, fontFamily: font.regular, fontSize: 16 * scale }]}
      />
      {results.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.name}, ${r.country}`}
          onPress={() => { const p = placePoint(r.id); if (p) { onPick(p); setQuery(''); } }}
          style={({ pressed }) => [styles.result_item, { borderColor: colors.textMuted, opacity: pressed ? 0.6 : 1 }]}>
          <AppText>{r.name}</AppText>
          <AppText variant="caption" muted>{r.country}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Button label={label} selected={selected} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} />;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2 },
  content: { padding: layout.space(5), gap: layout.space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space(3) },
  endpoint: { gap: layout.space(1) },
  search: { minHeight: layout.minTouchTarget, borderWidth: 2, borderRadius: layout.radius, paddingHorizontal: layout.space(3) },
  result_item: { minHeight: layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: layout.space(3), borderBottomWidth: StyleSheet.hairlineWidth },
  result: { borderWidth: 2, borderRadius: layout.radius, padding: layout.space(4), gap: layout.space(1) },
  trips: { marginTop: layout.space(2) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.space(2) },
  settings: { gap: layout.space(2), marginTop: layout.space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.space(2) },
});
