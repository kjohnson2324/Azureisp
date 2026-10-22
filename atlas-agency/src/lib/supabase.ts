import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/**
 * Personal devices keep the session in the OS keychain. Shared classroom
 * devices keep it in memory only, so closing the app signs the student out
 * and nothing about them is left on disk.
 */
const memory = new Map<string, string>();
const memoryStorage: SupportedStorage = {
  getItem: async (k) => memory.get(k) ?? null,
  setItem: async (k, v) => void memory.set(k, v),
  removeItem: async (k) => void memory.delete(k),
};
const secureStorage: SupportedStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};

export type DeviceMode = 'personal' | 'shared';

export function createAtlasClient(mode: DeviceMode) {
  return createClient(url, key, {
    auth: {
      storage: mode === 'shared' ? memoryStorage : secureStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}
