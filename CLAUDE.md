# Cheatsheet — command quick reference (PWA)

Personal, offline-first PWA to search and copy developer commands (Linux, Windows CMD, PowerShell, Git, npm, Laravel Artisan, Claude Code). No backend. The user works on Windows (no WSL).

## Commands

```bash
npm install            # install dependencies
npm run build-data     # data/*.yaml -> src/generated/commands.json (validates entries)
npm run dev            # dev server (runs build-data first via predev)
npm run build          # production build into dist/ (runs build-data first via prebuild)
npm run preview        # serve dist/ — use this to test the service worker / offline / install
```

The service worker is only active in `build` + `preview`, not in `dev`.

## Stack

- Vite + vanilla JavaScript (ES modules, no framework, no TypeScript).
- Fuse.js for fuzzy search, js-yaml for parsing data, vite-plugin-pwa (Workbox) for manifest + service worker.
- Plain CSS with custom properties; light/dark via `prefers-color-scheme`.

## Project layout

```
pdfs/              Original PDF cheatsheets (reference only, not used at runtime)
data/              SOURCE OF TRUTH — one YAML file per tool (linux.yaml, git.yaml, ...)
scripts/           Node scripts (build-data.js)
src/generated/     Generated JSON — never edit by hand, gitignored
src/               App code (see "Code conventions")
public/            Static assets (icons)
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

## Out of scope for now (keep the structure ready)

Favorites, recents, placeholder fill-in form before copying, editing commands in the app. They will rely on the stable `id` and `placeholders` fields and on a storage module (localStorage) — do not implement until asked.
