import './styles.css';
import data from './generated/commands.json';
import { copyText } from './clipboard.js';
import {
  addRecent,
  loadCollections,
  onCollectionsChangedElsewhere,
  saveCollection,
  toggleFavorite,
} from './collections.js';
import { initKeyboard } from './keyboard.js';
import {
  flashCopied,
  optionId,
  renderFilters,
  renderResults,
  renderSelection,
  renderStatus,
  showToast,
} from './render.js';
import { createSearch } from './search.js';
import { setState, state, subscribe } from './state.js';
import { FILTERS, TOOLS, isCollection, toolLabel } from './tools.js';

const toolOrder = new Map(TOOLS.map((t, i) => [t.id, i]));
const commands = data.commands
  .map((c) => ({ ...c, toolLabel: toolLabel(c.tool) }))
  .sort((a, b) => (toolOrder.get(a.tool) ?? 99) - (toolOrder.get(b.tool) ?? 99));
const commandIds = new Set(commands.map((c) => c.id));
const search = createSearch(commands);

const els = {
  header: document.querySelector('.top'),
  input: document.getElementById('search'),
  filters: document.getElementById('filters'),
  status: document.getElementById('status'),
  list: document.getElementById('results'),
  toast: document.getElementById('toast'),
};

// Matches for the current query across all tools; the active filter is applied on top.
let matches = [];

function applyFilter(items, s) {
  if (s.filter === 'all') return items;
  if (isCollection(s.filter)) {
    const order = new Map(s[s.filter].map((id, i) => [id, i]));
    const inCollection = items.filter((c) => order.has(c.id));
    // Without a query, newest first; with one, keep search relevance.
    return s.query.trim() ? inCollection : inCollection.sort((a, b) => order.get(a.id) - order.get(b.id));
  }
  return items.filter((c) => c.tool === s.filter);
}

function update(patch, { keepSelection = false } = {}) {
  const next = { ...state, ...patch };
  if ('query' in patch) matches = search(next.query);
  const results = applyFilter(matches, next);
  const selected = keepSelection ? Math.min(state.selected, Math.max(0, results.length - 1)) : 0;
  setState({ ...patch, results, selected });
}

function countByFilter(items, s) {
  const favorites = new Set(s.favorites);
  const recent = new Set(s.recent);
  const counts = new Map([
    ['all', items.length],
    ['favorites', 0],
    ['recent', 0],
  ]);
  for (const c of items) {
    counts.set(c.tool, (counts.get(c.tool) ?? 0) + 1);
    if (favorites.has(c.id)) counts.set('favorites', counts.get('favorites') + 1);
    if (recent.has(c.id)) counts.set('recent', counts.get('recent') + 1);
  }
  return counts;
}

subscribe((s, prev) => {
  const resultsChanged = s.results !== prev.results;
  const viewChanged = s.query !== prev.query || s.filter !== prev.filter;
  const favoritesChanged = s.favorites !== prev.favorites;

  if (resultsChanged || favoritesChanged) renderResults(els.list, s.results, s);
  if (resultsChanged || favoritesChanged || s.recent !== prev.recent) {
    renderFilters(els.filters, countByFilter(matches, s), s.filter);
  }
  if (resultsChanged) renderStatus(els.status, s.results, s.query);
  if (viewChanged) window.scrollTo(0, 0);
  if (resultsChanged || favoritesChanged || s.selected !== prev.selected) {
    // A new query or filter already reset the scroll to the top; otherwise keep the selection visible.
    renderSelection(els.list, els.input, s.results, s.selected, !viewChanged);
  }
});

function moveSelection(delta) {
  const last = state.results.length - 1;
  if (last < 0) return;
  setState({ selected: Math.min(last, Math.max(0, state.selected + delta)) });
}

// Alt+<index> in FILTERS order: 0 = all, then tools, then collections.
function selectFilter(index) {
  const filter = FILTERS[index]?.id;
  if (filter && filter !== state.filter) update({ filter });
}

function clear() {
  if (state.query) {
    els.input.value = '';
    update({ query: '' });
  } else if (state.filter !== 'all') {
    update({ filter: 'all' });
  }
}

async function copyCommand(index) {
  const command = state.results[index];
  if (!command) return;
  setState({ selected: index });
  try {
    await copyText(command.command);
  } catch {
    showToast(els.toast, 'Could not copy to the clipboard', true);
    return;
  }
  flashCopied(document.getElementById(optionId(command)));
  showToast(els.toast, `Copied: ${command.command}`);

  const recent = addRecent(state.recent, command.id);
  saveCollection('recent', recent);
  // Results are not recomputed, so the Recent list doesn't reorder under the cursor.
  setState({ recent });
}

function toggleFavoriteAt(index) {
  const command = state.results[index];
  if (!command) return;
  const favorites = toggleFavorite(state.favorites, command.id);
  saveCollection('favorites', favorites);
  const added = favorites.includes(command.id);
  if (state.filter === 'favorites') {
    update({ favorites }, { keepSelection: true });
  } else {
    setState({ favorites, selected: index });
  }
  showToast(els.toast, added ? `★ Added to favorites: ${command.command}` : `Removed from favorites: ${command.command}`);
}

els.input.addEventListener('input', () => update({ query: els.input.value }));

els.filters.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-filter]');
  if (!button) return;
  update({ filter: button.dataset.filter });
  els.input.focus(); // keep arrows/Enter working on the results
});

els.list.addEventListener('click', (e) => {
  const item = e.target.closest('.result');
  if (!item) return;
  const index = Number(item.dataset.index);
  if (e.target.closest('.star')) toggleFavoriteAt(index);
  else copyCommand(index);
});

initKeyboard({
  input: els.input,
  moveSelection,
  copySelected: () => copyCommand(state.selected),
  toggleFavorite: () => toggleFavoriteAt(state.selected),
  clear,
  selectFilter,
});

onCollectionsChangedElsewhere(() => update(loadCollections(commandIds), { keepSelection: true }));

// Lets selected results scroll into view below the sticky header (see .result scroll-margin-top).
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--header-h', `${entry.borderBoxSize[0].blockSize}px`);
}).observe(els.header);

update({ query: '', ...loadCollections(commandIds) });
