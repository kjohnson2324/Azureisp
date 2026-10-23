import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { defaultPreferences, Preferences } from './preferences';
import { darkTheme, fontFamily, lightTheme, type Theme } from '@/theme/tokens';

interface PreferencesValue {
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

const PreferencesContext = createContext<PreferencesValue>({ prefs: defaultPreferences, update: () => {} });

/**
 * Holds the current student's accessibility preferences. On a shared device the
 * provider is re-mounted per sign-in, so one student's settings never leak to the next.
 */
export function PreferencesProvider({ initial, children }: { initial?: Partial<Preferences>; children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => Preferences.parse({ ...initial }));
  const value = useMemo(() => ({ prefs, update: (patch: Partial<Preferences>) => setPrefs((p) => Preferences.parse({ ...p, ...patch })) }), [prefs]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = () => useContext(PreferencesContext);

export interface AppTheme {
  colors: Theme;
  dark: boolean;
  font: { regular: string; bold: string };
  /** Multiply font sizes by this (text-size preference). */
  scale: number;
}

export function useAppTheme(): AppTheme {
  const { prefs } = usePreferences();
  const dark = useColorScheme() === 'dark';
  return { colors: dark ? darkTheme : lightTheme, dark, font: fontFamily[prefs.font], scale: prefs.textScale };
}
