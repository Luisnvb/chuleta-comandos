// Shared by scripts/build-data.js (CLI) and the dev-only command editor (Vite plugin):
// validation rules, stable ids and the YAML -> JSON build.

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = join(root, 'data');
const OUT_FILE = join(root, 'src', 'generated', 'commands.json');

export const FIELD_ORDER = ['tool', 'category', 'command', 'description', 'tags', 'example'];
const REQUIRED = ['tool', 'category', 'command', 'description'];
const ALLOWED = new Set(FIELD_ORDER);

// {branch}, {new_name}. Braces with digits or spaces (stash@{1}, awk '{print $1}') are not placeholders.
const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
// Likely mistakes: <url>, {Branch}, {new-name}
const MALFORMED = [/<[a-z][\w-]*>/i, /\{(?![a-z][a-z0-9_]*\})[A-Za-z][\w-]*\}/];

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

// Stable as long as tool + command don't change; the hash keeps "-d" and "-D" apart.
export function makeId(tool, command) {
  const hash = createHash('sha1').update(`${tool}\0${command}`).digest('hex').slice(0, 6);
  return `${tool}-${slugify(command)}-${hash}`;
}

export function placeholdersOf(command) {
  return [...new Set([...command.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

// Tool ids come from the file names in data/.
export async function listTools() {
  return (await readdir(DATA_DIR))
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => f.replace(/\.ya?ml$/, ''))
    .sort();
}

export function toolFile(tool) {
  return join(DATA_DIR, `${tool}.yaml`);
}

export function validateEntry(entry, tool, where) {
  const errors = [];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return [`${where}: entry must be a mapping`];
  }
  for (const key of Object.keys(entry)) {
    if (!ALLOWED.has(key)) errors.push(`${where}: unknown field "${key}"`);
  }
  for (const key of REQUIRED) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) {
      errors.push(`${where}: "${key}" is required and must be a non-empty string`);
    }
  }
  if (entry.tool && entry.tool !== tool) {
    errors.push(`${where}: tool "${entry.tool}" does not match file name "${tool}"`);
  }
  if (entry.tags !== undefined && !(Array.isArray(entry.tags) && entry.tags.every((t) => typeof t === 'string'))) {
    errors.push(`${where}: "tags" must be a list of strings`);
  }
  if (entry.example !== undefined && typeof entry.example !== 'string') {
    errors.push(`${where}: "example" must be a string`);
  }
  if (typeof entry.command === 'string' && MALFORMED.some((re) => re.test(entry.command))) {
    errors.push(`${where}: malformed placeholder in "${entry.command}" (use {lowercase_name})`);
  }
  if (typeof entry.example === 'string' && PLACEHOLDER.test(entry.example)) {
    errors.push(`${where}: example must use concrete values, not placeholders`);
  }
  PLACEHOLDER.lastIndex = 0;
  return errors;
}

// Reads and validates every data file. Returns { tools, commands, errors }.
export async function buildData() {
  const commands = [];
  const tools = [];
  const errors = [];
  const seen = new Map();

  for (const tool of await listTools()) {
    const file = `${tool}.yaml`;
    let entries;
    try {
      entries = parse(await readFile(toolFile(tool), 'utf8'));
    } catch (err) {
      errors.push(`${file}: invalid YAML — ${err.message}`);
      continue;
    }
    if (!Array.isArray(entries)) {
      errors.push(`${file}: top level must be a list of entries`);
      continue;
    }

    entries.forEach((entry, i) => {
      const where = `${file} #${i + 1}${entry?.command ? ` (${entry.command})` : ''}`;
      const entryErrors = validateEntry(entry, tool, where);
      if (entryErrors.length) {
        errors.push(...entryErrors);
        return;
      }
      const key = `${tool}\0${entry.command}`;
      if (seen.has(key)) {
        errors.push(`${where}: duplicate of ${seen.get(key)}`);
        return;
      }
      seen.set(key, where);

      commands.push({
        id: makeId(tool, entry.command),
        tool,
        category: entry.category.trim(),
        command: entry.command,
        description: entry.description.trim(),
        tags: entry.tags ?? [],
        example: entry.example ?? null,
        placeholders: placeholdersOf(entry.command),
      });
    });
    tools.push({ id: tool, count: commands.filter((c) => c.tool === tool).length });
  }

  return { tools, commands, errors };
}

export async function writeGenerated({ tools, commands }) {
  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({ tools, commands }, null, 2) + '\n');
}
