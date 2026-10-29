// Modal form to fill in a command's {placeholders} before copying it.
//   Enter        next empty field; copies once every field has a value
//   Shift+Enter  copy the template as is
//   Esc          cancel (native <dialog> behaviour)
import { PLACEHOLDER, fillPlaceholders } from './placeholders.js';
import { escapeHtml } from './render.js';

function formatPreview(command, values) {
  return escapeHtml(command).replace(PLACEHOLDER, (match, name) => {
    const value = values[name]?.trim();
    return value ? `<mark class="filled">${escapeHtml(value)}</mark>` : `<span class="placeholder">${match}</span>`;
  });
}

// onCopy(command, text, values) is called with the final text; onClose runs after every close.
export function createFillForm(dialog, { onCopy, onClose }) {
  const els = {
    form: dialog.querySelector('form'),
    description: dialog.querySelector('.fill-description'),
    preview: dialog.querySelector('.fill-preview'),
    fields: dialog.querySelector('.fill-fields'),
    example: dialog.querySelector('.fill-example'),
  };
  let current = null;

  const inputs = () => [...els.fields.querySelectorAll('input')];
  const values = () => Object.fromEntries(inputs().map((i) => [i.name, i.value]));

  function renderPreview() {
    els.preview.innerHTML = formatPreview(current.command, values());
  }

  function copy(asTemplate = false) {
    const vals = values();
    onCopy(current, asTemplate ? current.command : fillPlaceholders(current.command, vals), asTemplate ? {} : vals);
    dialog.close();
  }

  // Enter moves through the empty fields and copies when there are none left.
  function advance(input) {
    const all = inputs();
    const empty = all.filter((i) => !i.value.trim());
    if (!empty.length) {
      copy();
      return;
    }
    const after = all.slice(all.indexOf(input) + 1).concat(all.slice(0, all.indexOf(input) + 1));
    const next = after.find((i) => !i.value.trim());
    next.focus();
    if (next === input) {
      input.classList.remove('missing');
      void input.offsetWidth; // restart the animation
      input.classList.add('missing');
    }
  }

  els.fields.addEventListener('input', renderPreview);
  // Tabbing onto a remembered value selects it, so typing replaces it.
  els.fields.addEventListener('focusin', (e) => e.target.select?.());

  els.form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('input')) return;
    e.preventDefault();
    if (e.shiftKey) copy(true);
    else advance(e.target);
  });

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    copy();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'template') copy(true);
    if (action === 'cancel') dialog.close();
  });

  dialog.addEventListener('close', () => {
    current = null;
    onClose();
  });

  return function open(command, remembered) {
    current = command;
    els.description.textContent = `${command.toolLabel} · ${command.description}`;
    els.example.innerHTML = command.example ? `<span>e.g.</span> <code>${escapeHtml(command.example)}</code>` : '';
    els.fields.innerHTML = command.placeholders
      .map(
        (name) => `
        <label class="fill-field">
          <span class="fill-label">{${escapeHtml(name)}}</span>
          <input name="${escapeHtml(name)}" value="${escapeHtml(remembered[name] ?? '')}"
            autocomplete="off" spellcheck="false" />
        </label>`,
      )
      .join('');
    renderPreview();
    dialog.showModal();
    // Remembered values are selected so typing replaces them.
    const first = inputs().find((i) => !i.value) ?? inputs()[0];
    first.focus();
    first.select();
  };
}
