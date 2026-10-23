import '@/i18n';

import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { PreferencesProvider } from '@/a11y/PreferencesContext';
import { offlineRuntime } from '@/offline/runtime';

export default function RootLayout() {
  // Both families ship in the app (SIL OFL), so switching fonts works offline.
  const [loaded] = useFonts({
    'AtkinsonHyperlegible-Regular': AtkinsonHyperlegible_400Regular,
    'AtkinsonHyperlegible-Bold': AtkinsonHyperlegible_700Bold,
    'OpenDyslexic-Regular': require('../../assets/fonts/OpenDyslexic-Regular.otf'),
    'OpenDyslexic-Bold': require('../../assets/fonts/OpenDyslexic-Bold.otf'),
  });
  // Apply any content cached by earlier region-pack downloads (no network needed).
  useEffect(() => {
    void offlineRuntime().catch(() => {});
  }, []);
  if (!loaded) return null;
  return (
    <PreferencesProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </PreferencesProvider>
  );
}
