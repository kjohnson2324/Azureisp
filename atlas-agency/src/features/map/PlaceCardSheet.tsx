import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';

import { cardSpeech, type PlaceCard } from './model';
import { usePreferences, useAppTheme } from '@/a11y/PreferencesContext';
import { speakAll, speakGreeting, stopSpeaking } from '@/a11y/speech';
import { FLAG_ASSETS } from '@/content/flagAssets';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

interface Props {
  card: PlaceCard;
  locale: 'en' | 'es';
  onClose: () => void;
}

/** Country / capital / city card: flag, greeting with audio, key facts, photo slot, read-aloud. */
export function PlaceCardSheet({ card, locale, onClose }: Props) {
  const { t } = useTranslation();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const [noVoice, setNoVoice] = useState(false);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${card.title}. ${card.subtitle}`);
    if (prefs.readAloud) void speakAll(cardSpeech(card, locale), locale, prefs);
    return () => {
      void stopSpeaking();
    };
    // Re-announce only when a different place opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.title, card.iso2]);

  const hearGreeting = async () => {
    const { usedFallback } = await speakGreeting(card.greeting, locale, prefs);
    setNoVoice(usedFallback);
  };

  return (
    <View
      testID="place-card"
      accessibilityViewIsModal
      style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.text }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image
            source={FLAG_ASSETS[card.iso2]}
            style={[styles.flag, { borderColor: colors.text }]}
            contentFit="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={card.flagAlt}
          />
          <View style={styles.titles}>
            <AppText variant="title" accessibilityRole="header">{card.title}</AppText>
            <AppText variant="caption" muted>{card.subtitle}</AppText>
          </View>
          <Button label={t('map.close')} icon="✕" onPress={onClose} testID="card-close" />
        </View>

        <View style={[styles.photo, { borderColor: colors.textMuted }]}>
          {card.photo ? (
            <Image source={{ uri: card.photo.path }} style={StyleSheet.absoluteFill} accessibilityLabel={card.photo.alt} />
          ) : (
            <AppText muted>{t('map.photoComingSoon')}</AppText>
          )}
        </View>

        <View style={[styles.greeting, { borderColor: colors.accent }]}>
          <View style={styles.titles}>
            <AppText variant="caption" muted>{t('map.greeting')}</AppText>
            <AppText variant="heading">{card.greeting.text}</AppText>
            <AppText variant="caption">{card.greeting.meaning}</AppText>
          </View>
          <Button label={t('map.hearGreeting')} icon="🔊" kind="primary" onPress={hearGreeting} testID="hear-greeting" />
        </View>
        {noVoice ? <AppText variant="caption" muted accessibilityLiveRegion="polite">{t('map.noVoice')}</AppText> : null}

        {card.kind === 'country' ? <Row label={t('map.capital')} value={card.capital} /> : null}
        {card.capitalNote ? <AppText variant="caption" muted>{card.capitalNote}</AppText> : null}
        <Row label={t('map.languages')} value={card.languages} />
        <Row label={t('map.currency')} value={card.currency} />

        <AppText variant="heading" accessibilityRole="header">{t('map.facts')}</AppText>
        {card.facts.map((f) => (
          <AppText key={f}>{`•  ${f}`}</AppText>
        ))}

        <View style={styles.actions}>
          <Button label={t('map.readAloud')} icon="📖" onPress={() => speakAll(cardSpeech(card, locale), locale, prefs)} testID="read-aloud" />
          <Button label={t('map.stop')} icon="⏹" onPress={stopSpeaking} />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" muted>{label}</AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '65%',
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 2,
  },
  content: { padding: layout.space(5), gap: layout.space(3) },
  header: { flexDirection: 'row', alignItems: 'center', gap: layout.space(3) },
  titles: { flex: 1 },
  flag: { width: 72, height: 54, borderWidth: 1, borderRadius: 4 },
  photo: { height: 140, borderWidth: 2, borderStyle: 'dashed', borderRadius: layout.radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greeting: { flexDirection: 'row', alignItems: 'center', gap: layout.space(3), borderWidth: 2, borderRadius: layout.radius, padding: layout.space(3) },
  row: { gap: 2 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.space(3) },
});
