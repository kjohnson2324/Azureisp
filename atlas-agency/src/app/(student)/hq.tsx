import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, lightTheme as theme } from '@/theme/tokens';

const SECTIONS = ['map', 'missions', 'review', 'spelling', 'play', 'passport'] as const;

export default function AgencyHQ() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('hq.title')}
        </Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
        {SECTIONS.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={t(`hq.${s}`)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <Text style={styles.tileLabel}>{t(`hq.${s}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: layout.space(5), gap: layout.space(3) },
  title: { fontSize: 32, fontWeight: '700', color: theme.text },
  tagline: { fontSize: 18, color: theme.textMuted, marginBottom: layout.space(2) },
  tile: {
    minHeight: layout.minTouchTarget * 1.5,
    borderRadius: layout.radius,
    borderWidth: 2,
    borderColor: theme.text,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    paddingHorizontal: layout.space(4),
  },
  pressed: { opacity: 0.7 },
  tileLabel: { fontSize: 20, fontWeight: '600', color: theme.text },
});
