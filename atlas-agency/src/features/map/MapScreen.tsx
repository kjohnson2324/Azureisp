import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AntarcticaCard } from './ContinentCard';
import { CountryList } from './CountryList';
import { prepareGlyphs } from './glyphs';
import { buildPlaceCard, countryCamera, type Selection, type TapResult } from './model';
import { PlaceCardSheet } from './PlaceCardSheet';
import { WorldMap, type WorldMapHandle } from './WorldMap';
import { usePreferences, useAppTheme } from '@/a11y/PreferencesContext';
import { countryRepository, type Locale } from '@/content/countries';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

export function MapScreen() {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'es' ? 'es' : 'en';
  const { prefs } = usePreferences();
  const { colors, dark } = useAppTheme();
  const repo = countryRepository();
  const mapRef = useRef<WorldMapHandle>(null);
  const router = useRouter();

  const [glyphsBase, setGlyphsBase] = useState<string>();
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selection, setSelection] = useState<Selection>();
  const [antarctica, setAntarctica] = useState(false);

  useEffect(() => {
    void prepareGlyphs().then(setGlyphsBase);
    // Screen-reader users start on the list, which is fully navigable without vision.
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => on && setMode('list'));
  }, []);

  const card = useMemo(() => (selection ? buildPlaceCard(selection, repo, locale) : undefined), [selection, repo, locale]);
  const selectedIso2 = selection?.kind === 'country' ? selection.iso2 : selection?.place.iso2;

  const onTap = (r: TapResult) => {
    if (r.action === 'zoomToContinent') {
      setSelection(undefined);
      if (r.continent === 'antarctica') setAntarctica(true);
      else mapRef.current?.flyToContinent(r.continent);
    } else if (r.action === 'select') {
      setAntarctica(false);
      setSelection(r.selection);
    }
  };

  const selectFromList = (iso2: string) => {
    setSelection({ kind: 'country', iso2 });
    const c = repo.get(iso2);
    if (c) {
      const cam = countryCamera(c);
      mapRef.current?.flyTo(cam.center, cam.zoom);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.toolbar}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{t('map.title')}</AppText>
        <Button label={t('map.mapView')} selected={mode === 'map'} onPress={() => setMode('map')} testID="mode-map" />
        <Button label={t('map.listView')} selected={mode === 'list'} onPress={() => setMode('list')} testID="mode-list" />
      </View>

      <View style={styles.body}>
        {mode === 'map' ? (
          glyphsBase ? (
            <>
              <WorldMap
                ref={mapRef}
                locale={locale}
                glyphsBase={glyphsBase}
                dark={dark}
                highContrast={prefs.highContrastMap}
                textScale={prefs.textScale}
                reduceMotion={prefs.reduceMotion}
                selectedIso2={selectedIso2}
                accessibilityLabel={t('map.a11yMap')}
                onTap={onTap}
              />
              <View style={styles.floating}>
                <Button label={t('map.backToWorld')} icon="🌍" onPress={() => { setSelection(undefined); mapRef.current?.showWorld(); }} />
                <Button label={t('map.downloads')} icon="⬇️" onPress={() => router.push('/downloads')} />
              </View>
            </>
          ) : (
            <AppText style={styles.loading}>{t('map.loading')}</AppText>
          )
        ) : (
          <CountryList countries={repo.all()} locale={locale} onSelect={selectFromList} />
        )}

        {card ? <PlaceCardSheet card={card} locale={locale} onClose={() => setSelection(undefined)} /> : null}
        {antarctica && !card ? <AntarcticaCard locale={locale} onClose={() => setAntarctica(false)} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: layout.space(2), paddingHorizontal: layout.space(4), paddingBottom: layout.space(2) },
  body: { flex: 1 },
  floating: { position: 'absolute', top: layout.space(3), right: layout.space(3), gap: layout.space(2), alignItems: 'flex-end' },
  loading: { padding: layout.space(5) },
});
