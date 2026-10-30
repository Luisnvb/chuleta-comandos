// Display order and labels for each tool. Ids match data/<id>.yaml.
export const TOOLS = [
  { id: 'linux', label: 'Linux' },
  { id: 'cmd', label: 'CMD' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'git', label: 'Git' },
  { id: 'npm', label: 'npm' },
  { id: 'artisan', label: 'Artisan' },
  { id: 'claude-code', label: 'Claude Code' },
];

// Collections are filters backed by the user's own lists (see collections.js).
export const COLLECTIONS = [
  { id: 'favorites', label: '★ Favorites' },
  { id: 'recent', label: 'Recent' },
];

// Favorites and Recent are hidden for now: no filter tabs, star buttons or Ctrl+D.
// The lists are still kept in localStorage, so turning this back on restores them.
export const SHOW_COLLECTIONS = false;

// Filter bar order; Alt+<index> selects each one.
export const FILTERS = [{ id: 'all', label: 'All' }, ...TOOLS, ...(SHOW_COLLECTIONS ? COLLECTIONS : [])];

const labels = new Map([...TOOLS, ...COLLECTIONS].map((t) => [t.id, t.label]));
const collectionIds = new Set(COLLECTIONS.map((c) => c.id));

export function toolLabel(id) {
  return labels.get(id) ?? id;
}

export function isCollection(filter) {
  return collectionIds.has(filter);
}
