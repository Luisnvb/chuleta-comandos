// Single source of app state. Modules read `state` and change it only through setState().
export const state = {
  query: '',
  tool: 'all', // 'all' or a tool id
  results: [],
  selected: 0, // index into results
};

const listeners = new Set();

export function setState(patch) {
  const prev = { ...state };
  Object.assign(state, patch);
  for (const fn of listeners) fn(state, prev);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
