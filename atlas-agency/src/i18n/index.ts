import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const device = getLocales()[0]?.languageCode;
const initial: AppLocale = device === 'es' ? 'es' : 'en';

// i18next's documented setup: configure the default instance.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
