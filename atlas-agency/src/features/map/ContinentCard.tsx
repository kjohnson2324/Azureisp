import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ANTARCTICA_FACTS } from './continents';
import { usePreferences, useAppTheme } from '@/a11y/PreferencesContext';
import { speakAll } from '@/a11y/speech';
import { pick, type Locale } from '@/content/countries';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

/** Antarctica has no countries, so tapping it shows a short fact card instead. */
export function AntarcticaCard({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const { t } = useTranslation();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const facts = ANTARCTICA_FACTS.map((f) => pick(f, locale));
  return (
    <View testID="antarctica-card" accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.text }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" accessibilityRole="header">{t('map.antarcticaTitle')}</AppText>
          <AppText variant="caption" muted>{t('map.antarcticaSubtitle')}</AppText>
        </View>
        <Button label={t('map.close')} icon="✕" onPress={onClose} />
      </View>
      {facts.map((f) => <AppText key={f}>{`•  ${f}`}</AppText>)}
      <Button label={t('map.readAloud')} icon="📖" onPress={() => speakAll([t('map.antarcticaTitle'), ...facts], locale, prefs)} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: layout.space(5), gap: layout.space(3), borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space(3) },
});
