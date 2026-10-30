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
- Fuse.js for fuzzy search, `yaml` (eemeli) for reading and comment-preserving writing of the data, vite-plugin-pwa (Workbox) for manifest + service worker.
- Plain CSS with custom properties; light/dark via `prefers-color-scheme`.

## Project layout

```
pdfs/              Original PDF cheatsheets — local only, gitignored (not redistributed)
data/              SOURCE OF TRUTH — one YAML file per tool (linux.yaml, git.yaml, ...)
scripts/           build-data.js (CLI), commands-lib.js (validation/ids/build, shared),
                   vite-plugin-command-editor.js (dev-only YAML editing API)
src/generated/     Generated JSON — never edit by hand, gitignored
src/               App code (see "Code conventions")
public/            favicon.svg (icon source) + generated PNG/ICO icons
```

## Data format (`data/<tool>.yaml`)

```yaml
- tool: git                      # must match the file name
  category: branches             # English, lowercase
  command: git switch -c {branch}  # variable parts as {placeholder}
  description: Creates a new branch and switches to it.   # English, one sentence
  tags: [branch, create]         # optional
  example: git switch -c feature/login               # optional, concrete values
```

Rules:
- One command per entry. Never combine alternatives (`cd .. / cd ~`) in one entry; split them.
- Always the full command (e.g. `php artisan make:model`, not `make:model`).
- Placeholders use `{lowercase_name}` (English, snake_case) — never `<x>`, `[x]` or bare words like `path`. Braces with digits or spaces (`stash@{1}`, `awk '{print $1}'`) are not treated as placeholders.
- No `[--optional]` syntax in `command`: keep the base command, mention the flag in `description` and show it in `example` (or add a separate entry if it is used often).
- Keyboard shortcuts (`Ctrl+R`) are valid entries under category `shortcuts`.
- Single-quote `command` and `example` values in YAML (Windows backslashes, `"`, `:`, `#`). Quote `description` if it contains `: ` or ` #`, and quote tags like `'null'`, `'yes'`, `'no'`.
- Descriptions, categories, placeholders, tags and example values in English.
- After editing YAML, run `npm run build-data`; it fails on missing fields, tool/file mismatch, duplicates or malformed placeholders.

The build step adds derived fields to each entry: a stable `id` (from tool + command) and `placeholders` (array of names). Do not write these in YAML.

## Code conventions

- Everything in English: code, identifiers, comments, UI text, docs and command data.
- Small ES modules with a single responsibility: data loading, search, rendering, keyboard handling, clipboard.
- No global mutable state scattered across modules: keep app state in one place (`src/state.js`) and re-render from it.
- Keyboard first: every action must be reachable without the mouse (Ctrl+K focus search, ↑/↓ move, Enter copy, Esc clear).
- Accessible markup: results as a listbox with `aria-activedescendant`, visible focus, sufficient contrast in both themes.

## Search behaviour (`src/search.js`)

- Fuse.js (threshold 0.2, diacritics ignored) finds candidates; multi-word queries require every word to match some field, in any order.
- Candidates are re-ranked by literal word-start matches (command > tags / category / tool > description). If any candidate matches literally, purely fuzzy hits are dropped; otherwise fuzzy hits are kept (typo tolerance).
- When changing search, check sample queries in Node (`stash`, `branch`, `kill`, `port`, `comit`, `create branch`) — top results must be the obvious commands.

## Keyboard shortcuts (`src/keyboard.js`)

Ctrl+K or `/` focus search · ↑/↓ move (PageUp/PageDown ±10) · Enter copy (or open the fill-in form) · Shift+Enter copy template as is · Ctrl+D toggle favorite (only with `SHOW_COLLECTIONS`) · Esc clears the query, then the filter · Alt+0…9 filter in `FILTERS` order (0 = all, 1–7 tools, 8 favorites, 9 recent — the last two only with `SHOW_COLLECTIONS`) · typing anywhere goes into the search box.

`FILTERS` (`src/tools.js`) = All + `TOOLS` + `COLLECTIONS`. With 7 tools the Alt digits are exactly used up: adding a tool pushes Favorites/Recent past Alt+9 — revisit the shortcut scheme then (and the hint in `index.html`).

## Favorites and recents (`src/collections.js`)

- **Hidden for now**: `SHOW_COLLECTIONS = false` in `src/tools.js` removes the filter tabs, the ☆ buttons and Ctrl+D. Stored lists are kept; set it to `true` to bring everything back.
- Stored per device in localStorage (`cheatsheet:favorites`, `cheatsheet:recent`) as lists of command `id`s, newest first. Recents keep the last 20 copies, no duplicates.
- Ids derive from tool + command text (`scripts/commands-lib.js`). Editing a command's text **by hand in the YAML** resets its favorite/recent status (the in-app editor migrates them); ids not present in the data are dropped on load. Editing description, tags, etc. is safe.
- All storage access is wrapped in try/catch: without storage the lists live in memory for the session. Corrupt values are ignored.
- They are filters like the tools: search works inside them; with an empty query they are sorted newest first. Copying in the Recent view updates the count but doesn't reorder the visible list.
- A `storage` event listener keeps several open windows (tab + installed app) in sync.

## Placeholder fill-in form (`src/fill-form.js`, `src/placeholders.js`)

- Enter / click on a command with `placeholders` opens a native `<dialog>`; commands without placeholders are copied directly. Shift+Enter (list or form) copies the template untouched.
- In the form, Enter jumps to the next empty field and copies when none are left; an empty field shakes instead of copying. Esc and backdrop click cancel. Focus returns to the search box on close.
- While a dialog is open, the global shortcuts in `keyboard.js` are disabled.
- Values are remembered per placeholder **name** (`cheatsheet:placeholder-values`), shared across commands and pre-filled + selected next time. Consistent placeholder names in the YAML (`{branch}`, `{file}`, `{url}`…) make this useful — reuse existing names when adding commands.
- The `PLACEHOLDER` regex lives in `placeholders.js` (same rule as `scripts/commands-lib.js`); values are inserted verbatim, no shell quoting.
- All localStorage access goes through `src/storage.js` (try/catch, fallback values).

## Command editor (dev only: `src/editor.js` + `scripts/vite-plugin-command-editor.js`)

- Only with `npm run dev`: `main.js` loads `editor.js` behind `import.meta.env.DEV` (excluded from the production bundle — verify with `grep -l "__api/commands" dist/assets/*.js` after a build), and the Vite plugin has `apply: 'serve'`. The deployed app is read-only.
- UI: "+ New command" (Alt+N) and a ✎ button per result (Ctrl+E). Delete needs two clicks (no `confirm()`).
- API: `POST /__api/commands` `{ action: create|update|delete, id?, entry? }`. Entries are found by `id` (recomputed from each file), validated with the same rules as `build-data` (`scripts/commands-lib.js`), written to `data/<tool>.yaml`, then the JSON is regenerated. The tool must be an existing data file (no path traversal).
- YAML writing uses the `yaml` Document API: untouched entries keep their exact text; new/changed `command`/`example` are single-quoted, `tags` as `[a, b]`, output `{ lineWidth: 0, flowCollectionPadding: false, singleQuote: true }` (round-trips the current files byte for byte). New entries go after the last one of the same category; a deleted entry hands its section comment to the next one.
- The app picks up the regenerated JSON through `import.meta.hot.accept` (no page reload). When a command's text changes its id changes; the save response carries `previousId` and `main.js` migrates favorites/recents (`replaceId`). Save response and HMR update can arrive in either order — both call `refresh()`.
- After editing in the app: review `git diff data/`, then commit + push to publish.
