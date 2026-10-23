import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { layout, lightTheme as theme } from '@/theme/tokens';

const SECTIONS = ['map', 'missions', 'review', 'spelling', 'play', 'passport'] as const;
// Routes land step by step; tiles without a route yet are shown but disabled.
const ROUTES: Partial<Record<(typeof SECTIONS)[number], '/map' | '/missions'>> = { map: '/map', missions: '/missions' };

export default function AgencyHQ() {
  const { t } = useTranslation();
  const router = useRouter();
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
            accessibilityState={{ disabled: !ROUTES[s] }}
            disabled={!ROUTES[s]}
            onPress={() => { const r = ROUTES[s]; if (r) router.push(r); }}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed, !ROUTES[s] && styles.disabled]}
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
  disabled: { opacity: 0.45 },
  tileLabel: { fontSize: 20, fontWeight: '600', color: theme.text },
});
