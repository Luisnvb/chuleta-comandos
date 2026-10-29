import Fuse from 'fuse.js';

const KEYS = [
  { name: 'command', weight: 3 },
  { name: 'description', weight: 2 },
  { name: 'tags', weight: 1.5 },
  { name: 'category', weight: 1 },
  { name: 'toolLabel', weight: 1 },
];

// Returns search(query) -> matching commands, best first. An empty query returns everything.
// Multi-word queries require every word to match some field, in any order ("rama crear").
export function createSearch(commands) {
  const fuse = new Fuse(commands, {
    keys: KEYS,
    threshold: 0.3,
    ignoreLocation: true,
    ignoreDiacritics: true,
  });

  return function search(query) {
    const words = query.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return commands;

    const fuseQuery =
      words.length === 1
        ? words[0]
        : { $and: words.map((w) => ({ $or: KEYS.map((k) => ({ [k.name]: w })) })) };
    return fuse.search(fuseQuery).map((r) => r.item);
  };
}
