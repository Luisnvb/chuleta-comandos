// Global keyboard shortcuts. Behaviour lives in main.js; this module only maps keys to actions.
//   Ctrl+K or /     focus the search box
//   ↑ ↓             move the selection (PageUp/PageDown jump 10)
//   Enter           copy the selected command
//   Esc             clear the query, then reset the tool filter
//   Alt+0…9         filter by tool (0 = all)
//   any character   typed outside the search box goes into it

const PAGE = 10;

export function initKeyboard({ input, moveSelection, copySelected, clear, selectTool }) {
  document.addEventListener('keydown', (e) => {
    const target = e.target instanceof Element ? e.target : document.body;
    const inSearch = target === input;
    const inOtherField = !inSearch && target.closest('input, textarea, select, [contenteditable]');
    if (inOtherField || e.isComposing) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit\d$/.test(e.code)) {
      e.preventDefault();
      selectTool(Number(e.code.slice(5)));
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        return;
      case 'PageDown':
        e.preventDefault();
        moveSelection(PAGE);
        return;
      case 'PageUp':
        e.preventDefault();
        moveSelection(-PAGE);
        return;
      case 'Enter':
        // Let Enter activate focused buttons (tool filters).
        if (target.closest('button')) return;
        e.preventDefault();
        copySelected();
        return;
      case 'Escape':
        e.preventDefault();
        clear();
        input.focus();
        return;
      case '/':
        if (!inSearch) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
    }

    // Typing anywhere else starts a search: move focus first so the character lands in the box.
    if (!inSearch && e.key.length === 1 && e.key !== ' ') input.focus();
  });
}
