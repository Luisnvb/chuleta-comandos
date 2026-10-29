import { TOOLS, toolLabel } from './tools.js';

const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatCommand(command) {
  return escapeHtml(command).replace(PLACEHOLDER, '<span class="placeholder">{$1}</span>');
}

export function optionId(command) {
  return `opt-${command.id}`;
}

// counts: Map(toolId -> number of matches for the current query)
export function renderFilters(container, counts, activeTool) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const buttons = [{ id: 'all', label: 'All', count: total }].concat(
    TOOLS.map((t) => ({ ...t, count: counts.get(t.id) ?? 0 })),
  );
  container.innerHTML = buttons
    .map(
      (b) => `
      <button type="button" class="filter" data-tool="${b.id}" aria-pressed="${b.id === activeTool}"
        ${b.count === 0 && b.id !== activeTool ? 'disabled' : ''}>
        ${escapeHtml(b.label)} <span class="filter-count">${b.count}</span>
      </button>`,
    )
    .join('');
}

export function renderResults(list, results, { query, tool }) {
  if (!results.length) {
    list.innerHTML = `<li class="empty">No commands match “${escapeHtml(query.trim())}”${
      tool === 'all' ? '' : ` in ${escapeHtml(toolLabel(tool))}`
    }.</li>`;
    return;
  }
  const showTool = tool === 'all';
  list.innerHTML = results
    .map(
      (c, i) => `
      <li class="result" role="option" id="${optionId(c)}" data-index="${i}" aria-selected="false">
        <div class="result-main">
          <code class="result-command">${formatCommand(c.command)}</code>
          <p class="result-description">${escapeHtml(c.description)}</p>
          ${c.example ? `<p class="result-example"><span>e.g.</span> <code>${escapeHtml(c.example)}</code></p>` : ''}
        </div>
        <div class="result-meta">
          ${showTool ? `<span class="chip chip-tool" data-tool="${c.tool}">${escapeHtml(c.toolLabel)}</span>` : ''}
          <span class="chip">${escapeHtml(c.category)}</span>
        </div>
      </li>`,
    )
    .join('');
}

export function renderSelection(list, input, results, selected) {
  list.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  const command = results[selected];
  if (!command) {
    input.removeAttribute('aria-activedescendant');
    return;
  }
  const el = document.getElementById(optionId(command));
  el.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', el.id);
}

export function renderStatus(el, results, query) {
  const n = results.length;
  el.textContent = query.trim() ? `${n} result${n === 1 ? '' : 's'}` : `${n} commands`;
}

let toastTimer;
export function showToast(el, message, isError = false) {
  el.textContent = message;
  el.classList.toggle('toast-error', isError);
  el.classList.add('toast-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast-visible'), 1800);
}

export function flashCopied(el) {
  el.classList.remove('copied');
  void el.offsetWidth; // restart the animation
  el.classList.add('copied');
}
