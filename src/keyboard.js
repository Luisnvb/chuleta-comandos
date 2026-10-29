// Global keyboard shortcuts. Behaviour lives in main.js; this module only maps keys to actions.
//   Ctrl+K or /     focus the search box
//   ↑ ↓             move the selection (PageUp/PageDown jump 10)
//   Enter           copy the selected command, or open the fill-in form if it has placeholders
//   Shift+Enter     copy the selected command as is, placeholders included
//   Ctrl+D          add/remove the selected command from favorites
//   Ctrl+E / Alt+N  edit the selected command / new command (dev only, when handlers are given)
//   Esc             clear the query, then reset the filter
//   Alt+0…9         select a filter (0 = all, then tools, favorites, recent)
//   any character   typed outside the search box goes into it

const PAGE = 10;

export function initKeyboard({
  input,
  moveSelection,
  activateSelected,
  copySelectedTemplate,
  toggleFavorite,
  clear,
  selectFilter,
  editSelected,
  createCommand,
}) {
  document.addEventListener('keydown', (e) => {
    // An open dialog (the fill-in form) handles its own keys.
    if (document.querySelector('dialog[open]')) return;
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

    // Overrides the browser's "bookmark this page", which is meaningless here.
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleFavorite();
      return;
    }

    if (editSelected && (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      editSelected();
      return;
    }

    if (createCommand && e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN') {
      e.preventDefault();
      createCommand();
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit\d$/.test(e.code)) {
      e.preventDefault();
      selectFilter(Number(e.code.slice(5)));
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
        if (e.shiftKey) copySelectedTemplate();
        else activateSelected();
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
