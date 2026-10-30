// Dev-only command editor: create, edit and delete commands from the app. Changes are written
// to data/*.yaml by the Vite dev server (scripts/vite-plugin-command-editor.js), so the YAML
// stays the single source of truth. Production builds never load this module.
import { escapeHtml } from './render.js';
import { TOOLS } from './tools.js';

const ENDPOINT = '/__api/commands';
const CONFIRM_MS = 3000;

const TEMPLATE = `
  <dialog id="editor" class="fill editor" aria-labelledby="editor-title">
    <form method="dialog" novalidate>
      <h2 id="editor-title" class="fill-title"></h2>
      <p class="fill-description">Saved to <code class="editor-file"></code></p>
      <div class="editor-grid">
        <label class="editor-field">
          <span>Tool</span>
          <select name="tool">${TOOLS.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('')}</select>
        </label>
        <label class="editor-field">
          <span>Category</span>
          <input name="category" list="editor-categories" autocomplete="off" />
        </label>
        <label class="editor-field editor-wide">
          <span>Command <small>variable parts as {placeholder}</small></span>
          <input name="command" class="mono" autocomplete="off" spellcheck="false" />
        </label>
        <label class="editor-field editor-wide">
          <span>Description <small>one sentence</small></span>
          <input name="description" autocomplete="off" />
        </label>
        <label class="editor-field editor-wide">
          <span>Tags <small>optional, comma separated</small></span>
          <input name="tags" autocomplete="off" spellcheck="false" />
        </label>
        <label class="editor-field editor-wide">
          <span>Example <small>optional, concrete values</small></span>
          <input name="example" class="mono" autocomplete="off" spellcheck="false" />
        </label>
      </div>
      <datalist id="editor-categories"></datalist>
      <ul class="editor-errors" role="alert"></ul>
      <div class="fill-actions">
        <button type="button" class="button button-danger" data-action="delete">Delete</button>
        <span class="fill-spacer"></span>
        <button type="button" class="button" data-action="cancel" title="Esc">Cancel</button>
        <button type="submit" class="button button-primary">Save</button>
      </div>
      <p class="fill-hints" aria-hidden="true"><kbd>Enter</kbd> save · <kbd>Esc</kbd> cancel</p>
    </form>
  </dialog>`;

// getCommands(): current command list (for category suggestions)
// onSaved({ id, previousId, file, action }) after a successful change; onClose() after every close.
export function createEditor({ getCommands, onSaved, onClose }) {
  document.body.insertAdjacentHTML('beforeend', TEMPLATE);
  const dialog = document.getElementById('editor');
  const form = dialog.querySelector('form');
  const fields = form.elements;
  const els = {
    title: dialog.querySelector('.fill-title'),
    file: dialog.querySelector('.editor-file'),
    categories: dialog.querySelector('#editor-categories'),
    errors: dialog.querySelector('.editor-errors'),
    delete: dialog.querySelector('[data-action="delete"]'),
    save: dialog.querySelector('[type="submit"]'),
  };
  let editing = null; // command being edited; null when creating
  let confirmTimer;

  function syncTool() {
    const tool = fields.tool.value;
    els.file.textContent = `data/${tool}.yaml`;
    const categories = [...new Set(getCommands().filter((c) => c.tool === tool).map((c) => c.category))];
    els.categories.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}"></option>`).join('');
  }

  function showErrors(errors) {
    els.errors.innerHTML = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('');
  }

  function resetDelete() {
    clearTimeout(confirmTimer);
    els.delete.textContent = 'Delete';
    els.delete.classList.remove('confirming');
  }

  function setBusy(busy) {
    for (const el of form.elements) el.disabled = busy;
  }

  async function request(body) {
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        showErrors(json.errors);
        return null;
      }
      return json;
    } catch {
      showErrors(['Could not reach the dev server. Is `npm run dev` still running?']);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const entry = {
      tool: fields.tool.value,
      category: fields.category.value,
      command: fields.command.value,
      description: fields.description.value,
      tags: fields.tags.value.split(','),
      example: fields.example.value,
    };
    const action = editing ? 'update' : 'create';
    const result = await request({ action, id: editing?.id, entry });
    if (!result) {
      fields.command.focus(); // the fields were disabled during the request and lost focus
      return;
    }
    dialog.close();
    onSaved({ ...result, action });
  }

  // Two clicks to delete, without a blocking confirm() dialog.
  async function remove() {
    if (!els.delete.classList.contains('confirming')) {
      els.delete.textContent = 'Click again to delete';
      els.delete.classList.add('confirming');
      confirmTimer = setTimeout(resetDelete, CONFIRM_MS);
      return;
    }
    resetDelete();
    const result = await request({ action: 'delete', id: editing.id });
    if (!result) return;
    dialog.close();
    onSaved({ ...result, action: 'delete' });
  }

  fields.tool.addEventListener('change', syncTool);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'delete') remove();
    if (action === 'cancel') dialog.close();
  });

  dialog.addEventListener('close', () => {
    resetDelete();
    onClose();
  });

  // command: the command to edit, or null to create one; defaults: { tool, category } for new ones.
  return function open(command, defaults = {}) {
    editing = command;
    els.title.textContent = command ? 'Edit command' : 'New command';
    els.delete.hidden = !command;
    fields.tool.value = command?.tool ?? defaults.tool ?? TOOLS[0].id;
    fields.category.value = command?.category ?? defaults.category ?? '';
    fields.command.value = command?.command ?? '';
    fields.description.value = command?.description ?? '';
    fields.tags.value = command?.tags.join(', ') ?? '';
    fields.example.value = command?.example ?? '';
    showErrors([]);
    syncTool();
    dialog.showModal();
    (command || fields.category.value ? fields.command : fields.category).focus();
  };
}
