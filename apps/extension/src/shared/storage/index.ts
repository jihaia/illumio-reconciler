import type { ApertureStorage } from '../types';

const DEFAULTS: ApertureStorage = {
  servicenow: null,
  illumio: null,
  savedQueries: [],
  settings: {
    defaultExpiration: 4,
    autoOpenInIllumio: true,
  },
};

export const storage = {
  async get<K extends keyof ApertureStorage>(key: K): Promise<ApertureStorage[K]> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as ApertureStorage[K]) ?? DEFAULTS[key];
  },

  async set<K extends keyof ApertureStorage>(
    key: K,
    value: ApertureStorage[K]
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  },

  async getAll(): Promise<ApertureStorage> {
    const result = await chrome.storage.local.get(null);
    return { ...DEFAULTS, ...result } as ApertureStorage;
  },

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  },
};
