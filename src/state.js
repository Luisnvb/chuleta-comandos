// Single source of app state. Modules read `state` and change it only through setState().
export const state = {
  query: '',
  filter: 'all', // 'all', a tool id or a collection id ('favorites', 'recent')
  results: [],
  selected: 0, // index into results
  favorites: [], // command ids, newest first
  recent: [], // command ids, most recently copied first
  editable: false, // dev only: the command editor is available
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
