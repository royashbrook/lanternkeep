// local state only. a blocked or full store (private mode, a strict browser)
// must never stop a kid playing: reads fall back to nothing, writes report
// whether they stuck so the screen can say "not saving" instead of lying.

/** undefined when the store would not answer, null only when there is nothing there */
export function tryReadSlot(key: string): string | null | undefined {
  try {
    return localStorage.getItem(key);
  } catch {
    return undefined;
  }
}

export function writeSlot(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

export function readJson<T extends object>(key: string, fallback: T): T {
  const raw = tryReadSlot(key);
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? { ...fallback, ...value } : fallback;
  } catch {
    return fallback;
  }
}

export const writeJson = (key: string, value: unknown) => writeSlot(key, JSON.stringify(value));
