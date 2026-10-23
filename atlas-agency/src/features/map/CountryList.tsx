import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';

import { buildListSections } from './model';
import { useAppTheme } from '@/a11y/PreferencesContext';
import type { Locale } from '@/content/countries';
import type { Country } from '@/content/schemas';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';

interface Props {
  countries: readonly Country[];
  locale: Locale;
  onSelect: (iso2: string) => void;
}

/** Screen-reader-friendly alternative to the map: continents → countries, searchable. */
export function CountryList({ countries, locale, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors, font, scale } = useAppTheme();
  const [query, setQuery] = useState('');
  const sections = useMemo(
    () => buildListSections(countries, locale, query).map((s) => ({ key: s.continent, title: s.title, data: s.countries })),
    [countries, locale, query],
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('map.search')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('map.search')}
        autoCorrect={false}
        style={[styles.search, { borderColor: colors.text, color: colors.text, fontFamily: font.regular, fontSize: 16 * scale }]}
        testID="country-search"
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.iso2}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={[styles.header, { backgroundColor: colors.background }]}>
            <AppText variant="heading" accessibilityRole="header">{`${section.title} (${section.data.length})`}</AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}. ${t('map.capital')}: ${item.capital}`}
            onPress={() => onSelect(item.iso2)}
            style={({ pressed }) => [styles.item, { borderColor: colors.textMuted, opacity: pressed ? 0.6 : 1 }]}
            testID={`country-${item.iso2}`}
          >
            <AppText>{item.name}</AppText>
            <AppText variant="caption" muted>{item.capital}</AppText>
          </Pressable>
        )}
        ListEmptyComponent={<AppText style={styles.empty}>{t('map.noResults', { query })}</AppText>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  search: { minHeight: layout.minTouchTarget, borderWidth: 2, borderRadius: layout.radius, margin: layout.space(4), paddingHorizontal: layout.space(3) },
  header: { paddingHorizontal: layout.space(4), paddingVertical: layout.space(2) },
  item: { minHeight: layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: layout.space(4), paddingVertical: layout.space(2), borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { padding: layout.space(4) },
});
