// Favorites and recently copied commands, stored per device as lists of command ids,
// newest first.
import { readJSON, writeJSON } from './storage.js';

const KEYS = {
  favorites: 'cheatsheet:favorites',
  recent: 'cheatsheet:recent',
};

export const MAX_RECENT = 20;

function load(key) {
  const value = readJSON(key, []);
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

// validIds: ids present in the current data; entries for removed commands are dropped.
export function loadCollections(validIds) {
  return {
    favorites: load(KEYS.favorites).filter((id) => validIds.has(id)),
    recent: load(KEYS.recent).filter((id) => validIds.has(id)),
  };
}

export function saveCollection(name, ids) {
  writeJSON(KEYS[name], ids);
}

export function toggleFavorite(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}

export function addRecent(ids, id) {
  return [id, ...ids.filter((x) => x !== id)].slice(0, MAX_RECENT);
}

// Keeps several open windows (browser tab + installed app) in sync.
export function onCollectionsChangedElsewhere(callback) {
  const keys = new Set(Object.values(KEYS));
  window.addEventListener('storage', (e) => {
    if (keys.has(e.key)) callback();
  });
}
