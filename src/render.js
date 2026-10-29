import { COLLECTIONS, FILTERS, TOOLS, isCollection, toolLabel } from './tools.js';

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

// counts: Map(filterId -> number of matches for the current query)
export function renderFilters(container, counts, activeFilter) {
  container.innerHTML = FILTERS.map((f, i) => {
    const count = counts.get(f.id) ?? 0;
    // Collections stay clickable when empty so their empty state can explain how to fill them.
    const disabled = count === 0 && f.id !== activeFilter && !isCollection(f.id);
    return `${f.id === COLLECTIONS[0].id ? '<span class="filter-divider" aria-hidden="true"></span>' : ''}
      <button type="button" class="filter" data-filter="${f.id}" aria-pressed="${f.id === activeFilter}"
        title="Alt+${i}" aria-keyshortcuts="Alt+${i}" ${disabled ? 'disabled' : ''}>
        ${escapeHtml(f.label)} <span class="filter-count">${count}</span>
      </button>`;
  }).join('');
}

function emptyMessage({ query, filter, favorites, recent }) {
  if (filter === 'favorites' && !favorites.length) {
    return 'No favorites yet. Click ☆ on a command or select it and press <kbd>Ctrl</kbd>+<kbd>D</kbd>.';
  }
  if (filter === 'recent' && !recent.length) {
    return 'Nothing copied yet. Commands you copy will show up here.';
  }
  const where = filter === 'all' ? '' : ` in ${escapeHtml(toolLabel(filter))}`;
  return `No commands match “${escapeHtml(query.trim())}”${where}.`;
}

function starButton(isFavorite) {
  const action = isFavorite ? 'Remove from favorites' : 'Add to favorites';
  // tabindex -1: the list is driven from the search box (Ctrl+D), not by tabbing through stars.
  return `<button type="button" class="star" tabindex="-1" aria-pressed="${isFavorite}"
    aria-label="${action}" title="${action} (Ctrl+D)">${isFavorite ? '★' : '☆'}</button>`;
}

export function renderResults(list, results, s) {
  if (!results.length) {
    list.innerHTML = `<li class="empty">${emptyMessage(s)}</li>`;
    return;
  }
  const showTool = !TOOLS.some((t) => t.id === s.filter);
  const favorites = new Set(s.favorites);
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
          ${starButton(favorites.has(c.id))}
        </div>
      </li>`,
    )
    .join('');
}

export function renderSelection(list, input, results, selected, scroll = false) {
  list.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
  const command = results[selected];
  if (!command) {
    input.removeAttribute('aria-activedescendant');
    return;
  }
  const el = document.getElementById(optionId(command));
  el.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', el.id);
  if (scroll) el.scrollIntoView({ block: 'nearest' });
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
