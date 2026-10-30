import './styles.css';
import data from './generated/commands.json';
import { copyText } from './clipboard.js';
import {
  addRecent,
  loadCollections,
  onCollectionsChangedElsewhere,
  replaceId,
  saveCollection,
  toggleFavorite,
} from './collections.js';
import { createFillForm } from './fill-form.js';
import { initKeyboard } from './keyboard.js';
import { loadRememberedValues, rememberValues } from './placeholders.js';
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
import { FILTERS, SHOW_COLLECTIONS, TOOLS, isCollection, toolLabel } from './tools.js';

const toolOrder = new Map(TOOLS.map((t, i) => [t.id, i]));

// Replaced when the dev editor changes the data (see the HMR handler at the bottom).
let commands;
let commandIds;
let search;

// One hue per category name, in order of first appearance: golden-angle steps keep the
// categories of a tool (neighbours in the data) far apart on the color wheel.
function categoryHues(sorted) {
  const hues = new Map();
  for (const c of sorted) {
    if (!hues.has(c.category)) hues.set(c.category, Math.round((hues.size * 137.508) % 360));
  }
  return hues;
}

function setData(json) {
  const sorted = json.commands.toSorted((a, b) => (toolOrder.get(a.tool) ?? 99) - (toolOrder.get(b.tool) ?? 99));
  const hues = categoryHues(sorted);
  commands = sorted.map((c) => ({ ...c, toolLabel: toolLabel(c.tool), categoryHue: hues.get(c.category) }));
  commandIds = new Set(commands.map((c) => c.id));
  search = createSearch(commands);
}

setData(data);

const els = {
  header: document.querySelector('.top'),
  input: document.getElementById('search'),
  filters: document.getElementById('filters'),
  status: document.getElementById('status'),
  list: document.getElementById('results'),
  toast: document.getElementById('toast'),
  fill: document.getElementById('fill'),
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

  if (resultsChanged || favoritesChanged || s.editable !== prev.editable) renderResults(els.list, s.results, s);
  if (resultsChanged || favoritesChanged || s.recent !== prev.recent) {
    renderFilters(els.filters, countByFilter(matches, s), s.filter);
  }
  if (resultsChanged) renderStatus(els.status, s.results, s.query);
  if (viewChanged) window.scrollTo(0, 0);
  if (resultsChanged || favoritesChanged || s.editable !== prev.editable || s.selected !== prev.selected) {
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

// text: the command as copied (template or with placeholders filled in).
async function copy(command, text) {
  try {
    await copyText(text);
  } catch {
    showToast(els.toast, 'Could not copy to the clipboard', true);
    return;
  }
  const el = document.getElementById(optionId(command));
  if (el) flashCopied(el);
  showToast(els.toast, `Copied: ${text}`);

  const recent = addRecent(state.recent, command.id);
  saveCollection('recent', recent);
  // Results are not recomputed, so the Recent list doesn't reorder under the cursor.
  setState({ recent });
}

const openFillForm = createFillForm(els.fill, {
  onCopy: (command, text, values) => {
    rememberValues(values);
    copy(command, text);
  },
  onClose: () => els.input.focus(),
});

// Enter / click: commands with placeholders open the fill-in form, the rest are copied directly.
function activate(index) {
  const command = state.results[index];
  if (!command) return;
  setState({ selected: index });
  if (command.placeholders.length) openFillForm(command, loadRememberedValues());
  else copy(command, command.command);
}

function copyTemplate(index) {
  const command = state.results[index];
  if (!command) return;
  setState({ selected: index });
  copy(command, command.command);
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
  else if (e.target.closest('.edit')) editAt(index);
  else activate(index);
});

// --- dev-only command editor (src/editor.js writes data/*.yaml through the Vite dev server) ---

let openEditor = null;
// Id to select once the edited command shows up in the reloaded data.
let pendingSelectId = null;

function editAt(index) {
  const command = state.results[index];
  if (!openEditor || !command) return;
  setState({ selected: index });
  openEditor(command);
}

// New commands default to the active tool filter, else the selected command's tool and category.
function createCommand() {
  if (!openEditor) return;
  const selected = state.results[state.selected];
  if (TOOLS.some((t) => t.id === state.filter)) {
    openEditor(null, { tool: state.filter, category: selected?.tool === state.filter ? selected.category : '' });
  } else {
    openEditor(null, { tool: selected?.tool, category: selected?.category });
  }
}

// Recomputes the results from the current data, keeping the selection where possible.
// dataChanged: called from HMR with new data (vs. after the save response).
function refresh(dataChanged = false) {
  matches = search(state.query);
  update({}, { keepSelection: true });
  if (!pendingSelectId) return;
  const index = state.results.findIndex((c) => c.id === pendingSelectId);
  if (index !== -1) setState({ selected: index });
  if (index !== -1 || dataChanged) pendingSelectId = null;
}

// The save response and the HMR data update can arrive in either order; both call refresh().
function onSaved({ id, previousId, file, action }) {
  if (previousId && previousId !== id) {
    const favorites = replaceId(state.favorites, previousId, id);
    const recent = replaceId(state.recent, previousId, id);
    saveCollection('favorites', favorites);
    saveCollection('recent', recent);
    setState({ favorites, recent });
  }
  pendingSelectId = id;
  showToast(els.toast, action === 'delete' ? `Deleted from ${file}` : `Saved to ${file}`);
  refresh();
}

if (import.meta.env.DEV) {
  import('./editor.js').then(({ createEditor }) => {
    openEditor = createEditor({
      getCommands: () => commands,
      onSaved,
      onClose: () => els.input.focus(),
    });
    els.status.insertAdjacentHTML(
      'afterend',
      `<button type="button" class="button button-small new-command" title="Alt+N">+ New command</button>`,
    );
    document.querySelector('.new-command').addEventListener('click', createCommand);
    setState({ editable: true });
  });
}

if (import.meta.hot) {
  import.meta.hot.accept('./generated/commands.json', (mod) => {
    if (!mod) return;
    setData(mod.default);
    refresh(true);
  });
}

initKeyboard({
  input: els.input,
  moveSelection,
  activateSelected: () => activate(state.selected),
  copySelectedTemplate: () => copyTemplate(state.selected),
  // Only bound while collections are shown, so the browser keeps its own Ctrl+D otherwise.
  ...(SHOW_COLLECTIONS && { toggleFavorite: () => toggleFavoriteAt(state.selected) }),
  clear,
  selectFilter,
  // Only bound in dev, so production keeps the browser's own Ctrl+E / Alt+N.
  ...(import.meta.env.DEV && { editSelected: () => editAt(state.selected), createCommand }),
});

onCollectionsChangedElsewhere(() => update(loadCollections(commandIds), { keepSelection: true }));

// Lets selected results scroll into view below the sticky header (see .result scroll-margin-top).
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--header-h', `${entry.borderBoxSize[0].blockSize}px`);
}).observe(els.header);

update({ query: '', ...loadCollections(commandIds) });
