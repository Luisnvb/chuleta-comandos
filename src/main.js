import './styles.css';
import data from './generated/commands.json';
import { copyText } from './clipboard.js';
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
    renderSelection(els.list, els.input, s.results, s.selected);
  }
});

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
  if (button) update({ tool: button.dataset.tool });
});

els.list.addEventListener('click', (e) => {
  const item = e.target.closest('.result');
  if (item) copyCommand(Number(item.dataset.index));
});

update({ query: '' });
