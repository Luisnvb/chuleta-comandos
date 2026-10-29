import './styles.css';
import data from './generated/commands.json';
import { copyText } from './clipboard.js';
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
import { TOOLS, toolLabel } from './tools.js';

const toolOrder = new Map(TOOLS.map((t, i) => [t.id, i]));
const commands = data.commands
  .map((c) => ({ ...c, toolLabel: toolLabel(c.tool) }))
  .sort((a, b) => (toolOrder.get(a.tool) ?? 99) - (toolOrder.get(b.tool) ?? 99));
const search = createSearch(commands);

const els = {
  header: document.querySelector('.top'),
  input: document.getElementById('search'),
  filters: document.getElementById('filters'),
  status: document.getElementById('status'),
  list: document.getElementById('results'),
  toast: document.getElementById('toast'),
};

// Matches for the current query across all tools; the tool filter is applied on top.
let matches = [];

function update(patch) {
  const next = { ...state, ...patch };
  if ('query' in patch) matches = search(next.query);
  const results = next.tool === 'all' ? matches : matches.filter((c) => c.tool === next.tool);
  setState({ ...patch, results, selected: 0 });
}

function countByTool(items) {
  const counts = new Map();
  for (const c of items) counts.set(c.tool, (counts.get(c.tool) ?? 0) + 1);
  return counts;
}

subscribe((s, prev) => {
  if (s.results !== prev.results) {
    renderResults(els.list, s.results, s);
    renderFilters(els.filters, countByTool(matches), s.tool);
    renderStatus(els.status, s.results, s.query);
    window.scrollTo(0, 0);
  }
  if (s.results !== prev.results || s.selected !== prev.selected) {
    // Only scroll for selection moves; new results already reset the scroll to the top.
    renderSelection(els.list, els.input, s.results, s.selected, s.results === prev.results);
  }
});

function moveSelection(delta) {
  const last = state.results.length - 1;
  if (last < 0) return;
  setState({ selected: Math.min(last, Math.max(0, state.selected + delta)) });
}

// index 0 = all, 1… = TOOLS order
function selectTool(index) {
  const tool = index === 0 ? 'all' : TOOLS[index - 1]?.id;
  if (tool && tool !== state.tool) update({ tool });
}

function clear() {
  if (state.query) {
    els.input.value = '';
    update({ query: '' });
  } else if (state.tool !== 'all') {
    update({ tool: 'all' });
  }
}

async function copyCommand(index) {
  const command = state.results[index];
  if (!command) return;
  setState({ selected: index });
  try {
    await copyText(command.command);
    flashCopied(document.getElementById(optionId(command)));
    showToast(els.toast, `Copied: ${command.command}`);
  } catch {
    showToast(els.toast, 'Could not copy to the clipboard', true);
  }
}

els.input.addEventListener('input', () => update({ query: els.input.value }));

els.filters.addEventListener('click', (e) => {
  const button = e.target.closest('button[data-tool]');
  if (!button) return;
  update({ tool: button.dataset.tool });
  els.input.focus(); // keep arrows/Enter working on the results
});

els.list.addEventListener('click', (e) => {
  const item = e.target.closest('.result');
  if (item) copyCommand(Number(item.dataset.index));
});

initKeyboard({
  input: els.input,
  moveSelection,
  copySelected: () => copyCommand(state.selected),
  clear,
  selectTool,
});

// Lets selected results scroll into view below the sticky header (see .result scroll-margin-top).
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--header-h', `${entry.borderBoxSize[0].blockSize}px`);
}).observe(els.header);

update({ query: '' });
