import { readJSON, writeJSON } from './storage.js';

// {rama}, {nuevo_nombre}: same rule as scripts/build-data.js. Braces with digits or spaces
// (stash@{1}, awk '{print $1}') are not placeholders.
export const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;

// Empty values leave the placeholder as is.
export function fillPlaceholders(command, values) {
  return command.replace(PLACEHOLDER, (match, name) => values[name]?.trim() || match);
}

// Last value typed for each placeholder name, shared across commands: what you type for {rama}
// in `git switch` is suggested again in `git push -u origin {rama}`.
const VALUES_KEY = 'cheatsheet:placeholder-values';

export function loadRememberedValues() {
  const value = readJSON(VALUES_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function rememberValues(values) {
  const filled = Object.fromEntries(
    Object.entries(values)
      .map(([name, v]) => [name, v.trim()])
      .filter(([, v]) => v),
  );
  writeJSON(VALUES_KEY, { ...loadRememberedValues(), ...filled });
}
