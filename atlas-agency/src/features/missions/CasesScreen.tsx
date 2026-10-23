import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { casesFor } from './catalog';
import { useAppTheme } from '@/a11y/PreferencesContext';
import { countryRepository, pick, type Locale } from '@/content/countries';
import type { ProgressStore } from '@/offline/progress';
import { useStudent } from '@/session/StudentContext';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

export function CasesScreen({ load, onOpen }: { load: () => Promise<{ progress: ProgressStore }>; onOpen: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'es' ? 'es' : 'en';
  const { colors } = useAppTheme();
  const { gradeBand, studentId = 'local' } = useStudent();
  const [solved, setSolved] = useState<Map<string, number>>(new Map());
  const cases = casesFor(gradeBand);
  const repo = countryRepository();

  const refresh = useCallback(() => {
    void load().then((rt) => rt.progress.solved(studentId)).then(setSolved).catch(() => {});
  }, [load, studentId]);
  useEffect(refresh, [refresh]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={cases}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <AppText variant="title" accessibilityRole="header">{`🗂 ${t('case.casesTitle')}`}</AppText>
            <AppText>{t('case.casesIntro')}</AppText>
          </View>
        }
        renderItem={({ item }) => {
          const done = solved.has(item.id);
          const home = repo.get(item.mission.landmark.country);
          const label = `${pick(item.mission.title, locale)}. ${home ? pick(home.name, locale) : ''}. ${t('case.stops', { count: item.mission.stops.length })}. ${done ? t('case.solved') : t('case.newCase')}`;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => onOpen(item.id)}
              style={({ pressed }) => [styles.card, { borderColor: colors.text, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
              testID={`case-${item.id}`}
            >
              <AppText variant="heading">{pick(item.mission.title, locale)}</AppText>
              <AppText variant="caption" muted>
                {`📍 ${home ? pick(home.name, locale) : ''} · ${t('case.stops', { count: item.mission.stops.length })} · ${done ? `✅ ${t('case.solved')} (${solved.get(item.id)} ★)` : `🆕 ${t('case.newCase')}`}`}
              </AppText>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.space(4), gap: layout.space(3) },
  headerBox: { gap: layout.space(2), marginBottom: layout.space(2) },
  card: { minHeight: layout.minTouchTarget, borderWidth: 2, borderRadius: layout.radius, padding: layout.space(4), gap: layout.space(1) },
});
