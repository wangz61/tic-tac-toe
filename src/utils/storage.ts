/**
 * localStorage with an in-memory fallback, so the game keeps working in
 * private windows or when storage is blocked.
 */
const PREFIX = 'ttt:v1:';
const memory = new Map<string, string>();

export function load<T>(key: string, fallback: T): T {
  let raw: string | null | undefined;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    raw = memory.get(key);
  }
  if (raw == null) raw = memory.get(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    // Memory copy is enough for this session.
  }
}
