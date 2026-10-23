import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/a11y/PreferencesContext';
import { countryRepository, pick, type Locale } from '@/content/countries';
import { downloadRegionPack, packBytes, packStatus, removeRegionPack } from '@/offline/regionPacks';
import type { OfflineRuntime } from '@/offline/runtime';
import type { InstalledPack, RegionPackInfo } from '@/offline/types';
import { layout } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';

export const formatBytes = (n: number, locale: Locale) =>
  n < 1024 * 1024
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n / 1024)} KB`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1024 / 1024)} MB`;

type PackRuntime = Pick<OfflineRuntime, 'cache' | 'api' | 'tiles'>;

export function DownloadsScreen({ load }: { load: () => Promise<PackRuntime> }) {
  const { t, i18n } = useTranslation();
  const locale: Locale = i18n.language === 'es' ? 'es' : 'en';
  const { colors } = useAppTheme();
  const [rt, setRt] = useState<PackRuntime>();
  const [packs, setPacks] = useState<RegionPackInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [busy, setBusy] = useState<{ id: string; percent: number }>();
  const [error, setError] = useState<string>();

  const refresh = useCallback(async (r: PackRuntime) => {
    setInstalled(await r.cache.getInstalledPacks());
    if (r.api) setPacks(await r.api.listRegionPacks());
  }, []);

  useEffect(() => {
    void load().then(async (r) => {
      setRt(r);
      try { await refresh(r); } catch { setError(t('offline.noBackend')); }
    });
  }, [load, refresh, t]);

  const download = async (pack: RegionPackInfo) => {
    if (!rt?.api) return;
    setError(undefined);
    try {
      await downloadRegionPack(pack, { api: rt.api, cache: rt.cache, repo: countryRepository(), tiles: rt.tiles },
        (f) => setBusy({ id: pack.id, percent: Math.round(f * 100) }));
      await refresh(rt);
    } catch {
      setError(t('offline.failed'));
    } finally {
      setBusy(undefined);
    }
  };

  const remove = async (id: string) => {
    if (!rt) return;
    await removeRegionPack(id, { cache: rt.cache, tiles: rt.tiles });
    await refresh(rt);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={packs}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">{t('offline.title')}</AppText>
            <AppText>{t('offline.intro')}</AppText>
            <AppText variant="caption" muted>{t('offline.sharedDevice')}</AppText>
            {!rt?.api ? <AppText accessibilityLiveRegion="polite">{t('offline.noBackend')}</AppText> : null}
            {error ? <AppText accessibilityLiveRegion="assertive" style={{ color: colors.incorrect }}>{`⚠️ ${error}`}</AppText> : null}
          </View>
        }
        renderItem={({ item }) => {
          const status = packStatus(item, installed);
          const name = pick(item.name, locale);
          const progress = busy?.id === item.id ? busy.percent : undefined;
          return (
            <View style={[styles.card, { borderColor: colors.text, backgroundColor: colors.surface }]} testID={`pack-${item.id}`}>
              <AppText variant="heading">{name}</AppText>
              <AppText variant="caption" muted>
                {`${formatBytes(packBytes(item), locale)} · ${item.tiles ? t('offline.withTiles') : t('offline.contentOnly')}`}
              </AppText>
              {progress !== undefined ? (
                <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progress }}
                  accessibilityLabel={t('offline.progress', { name, percent: progress })}>
                  <View style={[styles.track, { borderColor: colors.text }]}>
                    <View style={[styles.fill, { width: `${progress}%`, backgroundColor: colors.accent }]} />
                  </View>
                  <AppText variant="caption">{t('offline.progress', { name, percent: progress })}</AppText>
                </View>
              ) : status === 'installed' ? (
                <View style={styles.row}>
                  <AppText style={{ flex: 1 }}>{`✅ ${t('offline.installed')}`}</AppText>
                  <Button label={t('offline.remove')} onPress={() => remove(item.id)} />
                </View>
              ) : (
                <Button
                  kind="primary"
                  icon="⬇️"
                  label={status === 'update' ? t('offline.update') : t('offline.download')}
                  accessibilityHint={name}
                  disabled={!!busy}
                  onPress={() => download(item)}
                />
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: layout.space(4), gap: layout.space(3) },
  header: { gap: layout.space(2), marginBottom: layout.space(2) },
  card: { borderWidth: 2, borderRadius: layout.radius, padding: layout.space(4), gap: layout.space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space(2) },
  track: { height: 12, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
});
