import { useSyncExternalStore } from "react";

// There are no accounts. This browser makes up a random key the first time it is used and sends
// it with every call; whoever holds the key can open the courses. The same key typed into
// another browser (Settings) brings the courses along.
const OWNER_KEY = "il.owner";
const SETTINGS_KEY = "il.settings";

export type Level = "beginner" | "intermediate" | "advanced";
export type Lang = "en" | "ar";
export type Settings = { level: Level; lessons: number; language: string; ui: Lang };
export const defaultSettings: Settings = { level: "beginner", lessons: 3, language: "auto", ui: "en" };

/** First visit: follow the browser's language. */
const detectLang = (): Lang => (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ar") ? "ar" : "en");

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode or blocked storage: fall back to this tab's memory
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* kept in memory below */
  }
};

let ownerCache: string | null = null;
function owner(): string {
  if (ownerCache) return ownerCache;
  let key = read(OWNER_KEY);
  if (!key || key.length < 24) {
    key = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    write(OWNER_KEY, key);
  }
  return (ownerCache = key);
}

/** The device key, or null on the server and during the first render in the browser. */
export const useOwner = () => useSyncExternalStore(subscribe, owner, () => null);

export function setOwner(key: string) {
  const clean = key.trim();
  if (clean.length < 24 || clean.length > 80) throw new Error("That doesn't look like a device key.");
  ownerCache = clean;
  write(OWNER_KEY, clean);
  emit();
}

let settingsRaw: string | null | undefined;
let settingsCache = defaultSettings;
function settings(): Settings {
  const raw = read(SETTINGS_KEY);
  if (raw !== settingsRaw) {
    settingsRaw = raw;
    try {
      settingsCache = { ...defaultSettings, ui: detectLang(), ...(raw ? JSON.parse(raw) : {}) };
    } catch {
      settingsCache = { ...defaultSettings, ui: detectLang() };
    }
  }
  return settingsCache;
}

export const useSettings = () => useSyncExternalStore(subscribe, settings, () => defaultSettings);

export function updateSettings(patch: Partial<Settings>) {
  const next = { ...settings(), ...patch };
  write(SETTINGS_KEY, JSON.stringify(next));
  settingsRaw = undefined; // re-read, so a blocked write still shows in this tab
  settingsCache = next;
  emit();
}
