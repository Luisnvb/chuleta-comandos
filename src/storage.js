// localStorage helpers. Storage may be unavailable (private mode, blocked site data): reads
// then return the fallback and writes are dropped, so callers keep their state in memory.

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the value lives in memory only.
  }
}
