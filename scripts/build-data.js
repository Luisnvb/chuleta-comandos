// Converts data/*.yaml into src/generated/commands.json, validating every entry.
// Usage: npm run build-data

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const outFile = join(root, 'src', 'generated', 'commands.json');

const REQUIRED = ['tool', 'category', 'command', 'description'];
const OPTIONAL = ['tags', 'example'];
const ALLOWED = new Set([...REQUIRED, ...OPTIONAL]);

// {rama}, {nuevo_nombre}. Braces with digits or spaces (stash@{1}, awk '{print $1}') are not placeholders.
const PLACEHOLDER = /\{([a-z][a-z0-9_]*)\}/g;
// Likely mistakes: <url>, {Rama}, {nuevo-nombre}
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
function makeId(tool, command) {
  const hash = createHash('sha1').update(`${tool}\0${command}`).digest('hex').slice(0, 6);
  return `${tool}-${slugify(command)}-${hash}`;
}

function validateEntry(entry, tool, where) {
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

async function main() {
  const files = (await readdir(dataDir)).filter((f) => /\.ya?ml$/.test(f)).sort();
  const commands = [];
  const tools = [];
  const errors = [];
  const seen = new Map();

  for (const file of files) {
    const tool = basename(file).replace(/\.ya?ml$/, '');
    let entries;
    try {
      entries = loadYaml(await readFile(join(dataDir, file), 'utf8'));
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
        placeholders: [...new Set([...entry.command.matchAll(PLACEHOLDER)].map((m) => m[1]))],
      });
    });
    tools.push({ id: tool, count: commands.filter((c) => c.tool === tool).length });
  }

  if (errors.length) {
    console.error(`build-data: ${errors.length} error(s)\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify({ tools, commands }, null, 2) + '\n');

  console.log(`build-data: ${commands.length} commands from ${files.length} files`);
  for (const t of tools) console.log(`  ${t.id.padEnd(12)} ${t.count}`);
}

main();
