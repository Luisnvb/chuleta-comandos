// Dev-only API that lets the app create, edit and delete commands by rewriting data/*.yaml.
// Comments, blank lines and quoting of untouched entries are preserved (yaml Document API).
// After each change the JSON is regenerated; Vite's HMR then pushes the new data to the page.
//
//   POST /__api/commands  { action: 'create' | 'update' | 'delete', id?, entry? }
//   -> 200 { ok: true, id, previousId, file }  |  400/404 { ok: false, errors: [...] }

import { readFile, writeFile } from 'node:fs/promises';
import { Scalar, isMap, parseDocument } from 'yaml';
import {
  FIELD_ORDER,
  buildData,
  listTools,
  makeId,
  toolFile,
  validateEntry,
  writeGenerated,
} from './commands-lib.js';

const ENDPOINT = '/__api/commands';
// Same output style as the hand-written files: no line folding, `[a, b]` lists, single quotes.
const STRINGIFY = { lineWidth: 0, flowCollectionPadding: false, singleQuote: true };

class ApiError extends Error {
  constructor(status, errors) {
    super(errors.join('; '));
    this.status = status;
    this.errors = errors;
  }
}

async function loadDoc(tool) {
  const doc = parseDocument(await readFile(toolFile(tool), 'utf8'));
  if (doc.errors.length) throw new ApiError(400, [`${tool}.yaml: ${doc.errors[0].message}`]);
  return doc;
}

async function saveDoc(tool, doc) {
  await writeFile(toolFile(tool), doc.toString(STRINGIFY));
}

// Finds the YAML node whose (tool, command) produces this id.
async function findById(id) {
  for (const tool of await listTools()) {
    const doc = await loadDoc(tool);
    const index = doc.contents.items.findIndex((item) => isMap(item) && makeId(tool, item.get('command')) === id);
    if (index !== -1) return { tool, doc, index };
  }
  throw new ApiError(404, [`Command not found (id ${id}). Was the YAML changed by hand? Reload the page.`]);
}

// Trims strings, drops empty optional fields and keeps only known fields.
function normalize(entry) {
  const out = {};
  for (const key of FIELD_ORDER) {
    const value = entry?.[key];
    if (key === 'tags') {
      const tags = (Array.isArray(value) ? value : []).map((t) => String(t).trim()).filter(Boolean);
      if (tags.length) out.tags = tags;
    } else if (typeof value === 'string' && value.trim()) {
      // Commands keep inner whitespace as typed; only the ends are trimmed.
      out[key] = value.trim();
    }
  }
  return out;
}

function nodeFor(doc, key, value) {
  if (key === 'command' || key === 'example') {
    const scalar = new Scalar(value);
    scalar.type = 'QUOTE_SINGLE'; // house style: Windows paths and quotes need no escaping
    return scalar;
  }
  if (key === 'tags') {
    const seq = doc.createNode(value);
    seq.flow = true;
    return seq;
  }
  return doc.createNode(value); // plain; yaml quotes it only when needed (": ", " #", …)
}

function applyFields(doc, map, entry) {
  for (const key of FIELD_ORDER) {
    if (entry[key] === undefined) map.delete(key);
    else if (key === 'tags' || entry[key] !== map.get(key)) map.set(key, nodeFor(doc, key, entry[key]));
  }
  // Keys parsed from the file are Scalar nodes; keys added by map.set() are plain strings.
  const rank = (pair) => FIELD_ORDER.indexOf(pair.key?.value ?? pair.key);
  map.items.sort((a, b) => rank(a) - rank(b));
}

// New entries go after the last one of the same category, or at the end of the file.
function insertNode(doc, node, category) {
  const items = doc.contents.items;
  let index = items.length;
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].get('category') === category) {
      index = i + 1;
      break;
    }
  }
  items.splice(index, 0, node);
}

// A section comment ("# --- branches ---") is attached to the first entry below it:
// hand it to the next entry instead of deleting it with this one.
function removeNode(doc, index) {
  const items = doc.contents.items;
  const [removed] = items.splice(index, 1);
  const next = items[index];
  if (removed.commentBefore && next && !next.commentBefore) {
    next.commentBefore = removed.commentBefore;
    next.spaceBefore = removed.spaceBefore;
  }
}

function assertNoDuplicate(doc, tool, command, exceptIndex = -1) {
  const clash = doc.contents.items.findIndex((item, i) => i !== exceptIndex && item.get('command') === command);
  if (clash !== -1) throw new ApiError(400, [`"${command}" already exists in ${tool}.yaml`]);
}

async function validate(entry) {
  const tools = await listTools();
  if (!tools.includes(entry.tool)) throw new ApiError(400, [`Unknown tool "${entry.tool}"`]);
  const errors = validateEntry(entry, entry.tool, 'Entry').map((e) => e.replace(/^Entry: /, ''));
  if (errors.length) throw new ApiError(400, errors);
}

async function handle({ action, id, entry: rawEntry }) {
  if (action === 'delete') {
    const source = await findById(id);
    removeNode(source.doc, source.index);
    await saveDoc(source.tool, source.doc);
    return { id: null, previousId: id, file: `data/${source.tool}.yaml` };
  }

  const entry = normalize(rawEntry);
  await validate(entry);
  const newId = makeId(entry.tool, entry.command);

  if (action === 'create') {
    const doc = await loadDoc(entry.tool);
    assertNoDuplicate(doc, entry.tool, entry.command);
    const node = doc.createNode({});
    applyFields(doc, node, entry);
    insertNode(doc, node, entry.category);
    await saveDoc(entry.tool, doc);
    return { id: newId, previousId: null, file: `data/${entry.tool}.yaml` };
  }

  if (action === 'update') {
    const source = await findById(id);
    if (source.tool === entry.tool) {
      assertNoDuplicate(source.doc, entry.tool, entry.command, source.index);
      applyFields(source.doc, source.doc.contents.items[source.index], entry);
      await saveDoc(entry.tool, source.doc);
    } else {
      // Moving to another tool: write the target first so a failure can't lose the entry.
      const target = await loadDoc(entry.tool);
      assertNoDuplicate(target, entry.tool, entry.command);
      const node = target.createNode({});
      applyFields(target, node, entry);
      insertNode(target, node, entry.category);
      await saveDoc(entry.tool, target);
      removeNode(source.doc, source.index);
      await saveDoc(source.tool, source.doc);
    }
    return { id: newId, previousId: id, file: `data/${entry.tool}.yaml` };
  }

  throw new ApiError(400, [`Unknown action "${action}"`]);
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, ['Invalid JSON body']);
  }
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export function commandEditor() {
  return {
    name: 'cheatsheet-command-editor',
    apply: 'serve', // never part of a production build
    configureServer(server) {
      server.middlewares.use(ENDPOINT, async (req, res) => {
        if (req.method !== 'POST') return send(res, 405, { ok: false, errors: ['Use POST'] });
        try {
          const result = await handle(await readBody(req));
          const data = await buildData();
          if (data.errors.length) throw new ApiError(400, data.errors);
          await writeGenerated(data); // HMR picks this up
          send(res, 200, { ok: true, ...result });
        } catch (err) {
          if (!(err instanceof ApiError)) server.config.logger.error(err.stack ?? String(err));
          send(res, err.status ?? 500, { ok: false, errors: err.errors ?? [String(err.message ?? err)] });
        }
      });
    },
  };
}
