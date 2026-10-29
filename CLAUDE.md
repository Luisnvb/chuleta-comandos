# Cheatsheet — command quick reference (PWA)

Personal, offline-first PWA to search and copy developer commands (Linux, Windows CMD, PowerShell, Git, npm, Laravel Artisan, Claude Code). No backend. The user works on Windows (no WSL).

## Commands

```bash
npm install            # install dependencies
npm run build-data     # data/*.yaml -> src/generated/commands.json (validates entries)
npm run dev            # dev server (runs build-data first via predev)
npm run build          # production build into dist/ (runs build-data first via prebuild)
npm run preview        # serve dist/ on http://localhost:4173 — service worker / offline / install
npm run generate-icons # regenerate PNG icons after editing public/favicon.svg
```

The service worker is only active in `build` + `preview`, not in `dev`.

## PWA

- vite-plugin-pwa (`generateSW`, `registerType: 'autoUpdate'`) precaches everything (JS with the bundled command data, CSS, HTML, icons): the app works with no server at all.
- Production: https://chuleta-comandos.vercel.app (Vercel project `luisnvb/chuleta-comandos`, connected to GitHub). **Every push to `main` deploys to production** — run `npm run build` locally before pushing. Other branches get preview URLs.
- Installed apps update themselves on the next open after a deploy (`sw.js` is served with `must-revalidate`).
- `npm run preview` (port 4173, pinned in `vite.config.js`) is for testing the service worker and offline mode locally. An app installed from localhost is bound to that port.
- Icons are generated from `public/favicon.svg` by `pwa-assets.config.js` (maskable/apple with the accent background). Generated PNGs are committed.

## Stack

- Vite + vanilla JavaScript (ES modules, no framework, no TypeScript).
- Fuse.js for fuzzy search, js-yaml for parsing data, vite-plugin-pwa (Workbox) for manifest + service worker.
- Plain CSS with custom properties; light/dark via `prefers-color-scheme`.

## Project layout

```
pdfs/              Original PDF cheatsheets — local only, gitignored (not redistributed)
data/              SOURCE OF TRUTH — one YAML file per tool (linux.yaml, git.yaml, ...)
scripts/           Node scripts (build-data.js)
src/generated/     Generated JSON — never edit by hand, gitignored
src/               App code (see "Code conventions")
public/            favicon.svg (icon source) + generated PNG/ICO icons
```

## Data format (`data/<tool>.yaml`)

```yaml
- tool: git                      # must match the file name
  category: ramas                # Spanish, lowercase
  command: git switch -c {rama}  # variable parts as {placeholder}
  description: Crea una rama nueva y cambia a ella   # Spanish, one sentence
  tags: [branch, crear]          # optional
  example: git switch -c feature/login               # optional, concrete values
```

Rules:
- One command per entry. Never combine alternatives (`cd .. / cd ~`) in one entry; split them.
- Always the full command (e.g. `php artisan make:model`, not `make:model`).
- Placeholders use `{lowercase_name}` (Spanish, snake_case) — never `<x>`, `[x]` or bare words like `ruta`. Braces with digits or spaces (`stash@{1}`, `awk '{print $1}'`) are not treated as placeholders.
- No `[--optional]` syntax in `command`: keep the base command, mention the flag in `description` and show it in `example` (or add a separate entry if it is used often).
- Keyboard shortcuts (`Ctrl+R`) are valid entries under category `atajos`.
- Single-quote `command` and `example` values in YAML (Windows backslashes, `"`, `:`, `#`). Quote `description` if it contains `: ` or ` #`, and quote tags like `'null'`, `'yes'`, `'no'`.
- Descriptions and categories in Spanish; tags may mix Spanish and English to help search.
- After editing YAML, run `npm run build-data`; it fails on missing fields, tool/file mismatch, duplicates or malformed placeholders.

The build step adds derived fields to each entry: a stable `id` (from tool + command) and `placeholders` (array of names). Do not write these in YAML.

## Code conventions

- Code, identifiers, comments, UI text and docs in English. Only command data (descriptions, categories) is in Spanish.
- Small ES modules with a single responsibility: data loading, search, rendering, keyboard handling, clipboard.
- No global mutable state scattered across modules: keep app state in one place (`src/state.js`) and re-render from it.
- Keyboard first: every action must be reachable without the mouse (Ctrl+K focus search, ↑/↓ move, Enter copy, Esc clear).
- Accessible markup: results as a listbox with `aria-activedescendant`, visible focus, sufficient contrast in both themes.

## Search behaviour (`src/search.js`)

- Fuse.js (threshold 0.2, diacritics ignored) finds candidates; multi-word queries require every word to match some field, in any order.
- Candidates are re-ranked by literal word-start matches (command > tags / category / tool > description). If any candidate matches literally, purely fuzzy hits are dropped; otherwise fuzzy hits are kept (typo tolerance).
- When changing search, check sample queries in Node (`stash`, `rama`, `kill`, `puerto`, `comit`, `crear rama`) — top results must be the obvious commands.

## Keyboard shortcuts (`src/keyboard.js`)

Ctrl+K or `/` focus search · ↑/↓ move (PageUp/PageDown ±10) · Enter copy (or open the fill-in form) · Shift+Enter copy template as is · Ctrl+D toggle favorite · Esc clears the query, then the filter · Alt+0…9 filter in `FILTERS` order (0 = all, 1–7 tools, 8 favorites, 9 recent) · typing anywhere goes into the search box.

`FILTERS` (`src/tools.js`) = All + `TOOLS` + `COLLECTIONS`. With 7 tools the Alt digits are exactly used up: adding a tool pushes Favorites/Recent past Alt+9 — revisit the shortcut scheme then (and the hint in `index.html`).

## Favorites and recents (`src/collections.js`)

- Stored per device in localStorage (`cheatsheet:favorites`, `cheatsheet:recent`) as lists of command `id`s, newest first. Recents keep the last 20 copies, no duplicates.
- Ids derive from tool + command text (`scripts/build-data.js`), so **editing a command's text resets its favorite/recent status**; ids not present in the data are dropped on load. Editing description, tags, etc. is safe.
- All storage access is wrapped in try/catch: without storage the lists live in memory for the session. Corrupt values are ignored.
- They are filters like the tools: search works inside them; with an empty query they are sorted newest first. Copying in the Recent view updates the count but doesn't reorder the visible list.
- A `storage` event listener keeps several open windows (tab + installed app) in sync.

## Placeholder fill-in form (`src/fill-form.js`, `src/placeholders.js`)

- Enter / click on a command with `placeholders` opens a native `<dialog>`; commands without placeholders are copied directly. Shift+Enter (list or form) copies the template untouched.
- In the form, Enter jumps to the next empty field and copies when none are left; an empty field shakes instead of copying. Esc and backdrop click cancel. Focus returns to the search box on close.
- While a dialog is open, the global shortcuts in `keyboard.js` are disabled.
- Values are remembered per placeholder **name** (`cheatsheet:placeholder-values`), shared across commands and pre-filled + selected next time. Consistent placeholder names in the YAML (`{rama}`, `{archivo}`, `{url}`…) make this useful — reuse existing names when adding commands.
- The `PLACEHOLDER` regex lives in `placeholders.js` (same rule as `scripts/build-data.js`); values are inserted verbatim, no shell quoting.
- All localStorage access goes through `src/storage.js` (try/catch, fallback values).

## Out of scope for now (keep the structure ready)

Editing commands in the app — do not implement until asked.
