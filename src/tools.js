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

// Filter bar order; Alt+<index> selects each one.
export const FILTERS = [{ id: 'all', label: 'All' }, ...TOOLS, ...COLLECTIONS];

const labels = new Map([...TOOLS, ...COLLECTIONS].map((t) => [t.id, t.label]));
const collectionIds = new Set(COLLECTIONS.map((c) => c.id));

export function toolLabel(id) {
  return labels.get(id) ?? id;
}

export function isCollection(filter) {
  return collectionIds.has(filter);
}
