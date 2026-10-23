// On-device text-to-speech (D6). Nothing is sent to a cloud voice service.
import * as Speech from 'expo-speech';

import type { Preferences } from './preferences';

type Voice = { language: string; identifier: string };

/**
 * Pick the best installed voice for a BCP-47 tag: exact match, then same
 * language, else undefined (the caller falls back to the student's locale).
 */
export function pickVoice(voices: readonly Voice[], tag: string): Voice | undefined {
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  const want = norm(tag);
  const lang = want.split('-')[0];
  return voices.find((v) => norm(v.language) === want) ?? voices.find((v) => norm(v.language).split('-')[0] === lang);
}

let voiceCache: Voice[] | undefined;
async function voices(): Promise<Voice[]> {
  if (!voiceCache) {
    try {
      voiceCache = (await Speech.getAvailableVoicesAsync()).map((v) => ({ language: v.language, identifier: v.identifier }));
    } catch {
      voiceCache = [];
    }
  }
  return voiceCache;
}

const LOCALE_VOICE = { en: 'en-US', es: 'es-MX' } as const;

export async function speak(text: string, tag: string, prefs: Pick<Preferences, 'speechRate'>) {
  const voice = pickVoice(await voices(), tag);
  Speech.stop();
  Speech.speak(text, { language: voice?.language ?? tag, voice: voice?.identifier, rate: prefs.speechRate });
  return { usedFallback: !voice };
}

/**
 * Say the greeting in its own language, then its meaning in the student's language.
 * If the device has no voice for the greeting's language, it is read with the
 * student's voice instead (and the card shows the written greeting).
 */
export async function speakGreeting(
  greeting: { text: string; ttsLang: string; meaning: string },
  locale: 'en' | 'es',
  prefs: Pick<Preferences, 'speechRate'>,
) {
  const result = await speak(greeting.text, greeting.ttsLang, prefs);
  const localVoice = pickVoice(await voices(), LOCALE_VOICE[locale]);
  Speech.speak(greeting.meaning, { language: localVoice?.language ?? LOCALE_VOICE[locale], voice: localVoice?.identifier, rate: prefs.speechRate });
  return result;
}

export async function speakAll(lines: readonly string[], locale: 'en' | 'es', prefs: Pick<Preferences, 'speechRate'>) {
  const voice = pickVoice(await voices(), LOCALE_VOICE[locale]);
  Speech.stop();
  for (const line of lines) Speech.speak(line, { language: voice?.language ?? LOCALE_VOICE[locale], voice: voice?.identifier, rate: prefs.speechRate });
}

export const stopSpeaking = () => Speech.stop();
