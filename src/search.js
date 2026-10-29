import Fuse from 'fuse.js';

const KEYS = [
  { name: 'command', weight: 3 },
  { name: 'description', weight: 2 },
  { name: 'tags', weight: 1.5 },
  { name: 'category', weight: 1 },
  { name: 'toolLabel', weight: 1 },
];

const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Fuse gives near-identical scores to many entries with an exact substring hit, so results are
// re-ranked by literal matches at the start of a word: in the command counts most, then tags,
// category and tool, then the description.
function literalScore(fields, words) {
  let score = 0;
  for (const w of words) {
    const wordStart = new RegExp(`(^|[^a-z0-9])${escapeRegExp(w)}`);
    if (wordStart.test(fields.command)) score += 4;
    if (fields.tags.some((t) => wordStart.test(t))) score += 2;
    if (wordStart.test(fields.category) || wordStart.test(fields.tool)) score += 2;
    if (wordStart.test(fields.description)) score += 1;
  }
  return score;
}

// Returns search(query) -> matching commands, best first. An empty query returns everything.
// Multi-word queries require every word to match some field, in any order ("rama crear").
export function createSearch(commands) {
  const fuse = new Fuse(commands, {
    keys: KEYS,
    threshold: 0.2,
    ignoreLocation: true,
    ignoreDiacritics: true,
  });

  const normalized = new Map(
    commands.map((c) => [
      c,
      {
        command: normalize(c.command),
        description: normalize(c.description),
        tags: c.tags.map(normalize),
        category: normalize(c.category),
        tool: normalize(c.toolLabel ?? c.tool),
      },
    ]),
  );

  return function search(query) {
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return commands;

    const fuseQuery =
      words.length === 1
        ? words[0]
        : { $and: words.map((w) => ({ $or: KEYS.map((k) => ({ [k.name]: w })) })) };

    const ranked = fuse
      .search(fuseQuery)
      .map((r, rank) => ({ item: r.item, rank, score: literalScore(normalized.get(r.item), words) }))
      .sort((a, b) => b.score - a.score || a.rank - b.rank);

    // When something matches literally, purely fuzzy hits ("stash" -> "slash") are noise.
    // When nothing does, the query probably has a typo and fuzzy hits are all we have.
    const literalOnly = ranked.some((r) => r.score > 0) ? ranked.filter((r) => r.score > 0) : ranked;
    return literalOnly.map((r) => r.item);
  };
}
