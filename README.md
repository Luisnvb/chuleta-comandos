# Cheatsheet

A personal, offline-first PWA to find and copy developer commands in a couple of keystrokes. No backend: the commands live in YAML files in this repo and are bundled into the app.

**Live: https://chuleta-comandos.vercel.app** — open it and install it from the address bar.

Everything — UI, command data and code — is in English.

| Light | Dark |
|---|---|
| ![Cheatsheet in light mode, searching "commit"](docs/screenshot-light.png) | ![Cheatsheet in dark mode, searching "commit"](docs/screenshot-dark.png) |

## Features

- **Fuzzy search** over command, description, tags and category, with typo tolerance and accents ignored. Multi-word queries match every word in any order (`create branch` = `branch create`).
- **Tool filter** with live match counts per tool.
- **Copy** with a click, or with <kbd>Enter</kbd> on the selected result.
- **Fill in placeholders**: commands with `{placeholders}` open a small form with a live preview before copying. Values are remembered per placeholder name, so `{branch}` typed once is suggested in every command that uses it. <kbd>Shift</kbd>+<kbd>Enter</kbd> copies the template as is.
- **Favorites and recents** (currently hidden, see `SHOW_COLLECTIONS` in `src/tools.js`): star commands with ☆ or <kbd>Ctrl</kbd>+<kbd>D</kbd>; the last 20 copied commands are kept automatically. Both are filters you can search within, and are stored in the browser (per device).
- **Keyboard first**: the whole app works without a mouse (see [shortcuts](#keyboard-shortcuts)).
- **Light / dark** theme following the system.
- **Installable PWA** that works fully offline, with no server running.

## Commands included

| Tool | Entries |
|---|---|
| Linux (bash) | 84 |
| Windows CMD | 74 |
| PowerShell | 67 |
| Git | 101 |
| npm | 41 |
| Laravel Artisan | 103 |
| Claude Code (CLI, flags, slash commands, shortcuts) | 72 |

Variable parts are shown as `{placeholders}`, e.g. `git switch -c {branch}`.

## Getting started

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173
```

### Install as an app

Open https://chuleta-comandos.vercel.app in Chrome or Edge (desktop or mobile) and click the install icon in the address bar. The installed app works offline and updates itself the next time it opens after a new deploy.

### Deployment

The repo is connected to Vercel: every push to `main` deploys to production (build command `npm run build`, output `dist/`), and other branches get preview URLs.

To test the production build locally, including the service worker and offline mode:

```bash
npm run build && npm run preview   # http://localhost:4173
```

## Keyboard shortcuts

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>K</kbd> or <kbd>/</kbd> | Focus the search box |
| <kbd>↑</kbd> <kbd>↓</kbd> | Move the selection (<kbd>PgUp</kbd> / <kbd>PgDn</kbd> jump 10) |
| <kbd>Enter</kbd> | Copy the selected command (opens the fill-in form if it has placeholders) |
| <kbd>Shift</kbd>+<kbd>Enter</kbd> | Copy the selected command as is, placeholders included |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Add / remove the selected command from favorites (only while favorites are shown) |
| <kbd>Esc</kbd> | Clear the search, then the filter |
| <kbd>Alt</kbd>+<kbd>0</kbd>…<kbd>7</kbd> | Filter: 0 = all, 1–7 = tools (8 = favorites, 9 = recent when shown) |
| Any character | Typing anywhere goes into the search box |

In the fill-in form: <kbd>Enter</kbd> jumps to the next empty field and copies once all are filled, <kbd>Shift</kbd>+<kbd>Enter</kbd> copies the template, <kbd>Esc</kbd> cancels.

## Adding or editing commands

### From the app (dev mode)

Run `npm run dev` and the app gains an editor: **+ New command** (<kbd>Alt</kbd>+<kbd>N</kbd>) and a ✎ button on each result (<kbd>Ctrl</kbd>+<kbd>E</kbd> on the selected one). You can change any field, move a command to another tool, or delete it (click Delete twice).

Changes are written straight into `data/*.yaml` through the Vite dev server, keeping comments, order and quoting style, and the app updates without reloading. Review them with `git diff`, then commit and push to publish. The deployed app is read-only: the editor is not part of the production build.

### By hand

The YAML files in [`data/`](data/) are the single source of truth, one file per tool:

```yaml
- tool: git                      # must match the file name (data/git.yaml)
  category: branches
  command: 'git switch -c {branch}'
  description: Creates a new branch and switches to it.
  tags: [branch, create]          # optional
  example: 'git switch -c feature/login'   # optional, concrete values
```

Then run:

```bash
npm run build-data
```

It converts the YAML into `src/generated/commands.json` and fails with a clear message on missing fields, unknown fields, a `tool` that doesn't match the file name, duplicates, malformed placeholders (`<url>`, `{Rama}`) or placeholders inside `example`. `dev` and `build` run it automatically.

To add a new tool, create `data/<tool>.yaml` and add it to [`src/tools.js`](src/tools.js) (label and order).

See [`CLAUDE.md`](CLAUDE.md) for the full data conventions.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (no service worker) |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve `dist/` on port 4173 (service worker, offline, install) |
| `npm run build-data` | Validate `data/*.yaml` and generate the JSON |
| `npm run generate-icons` | Regenerate the PNG icons from `public/favicon.svg` |

## Project structure

```
data/              Command data, one YAML per tool (source of truth)
scripts/
  build-data.js                  YAML -> JSON (npm run build-data)
  commands-lib.js                Validation, ids and build shared by both scripts
  vite-plugin-command-editor.js  Dev-only API that edits data/*.yaml
src/
  main.js          Wiring: data, state, events
  state.js         Single app state
  search.js        Fuse.js search + re-ranking
  render.js        DOM rendering
  keyboard.js      Keyboard shortcuts
  clipboard.js     Copy with fallback
  fill-form.js     Placeholder fill-in dialog
  placeholders.js  Placeholder parsing, filling and remembered values
  editor.js        Command editor dialog (dev only)
  collections.js   Favorites and recents
  storage.js       Safe localStorage helpers
  tools.js         Tool labels, filter order
  styles.css
public/            Icon source (favicon.svg) and generated icons
```

## Tech stack

[Vite](https://vite.dev) · vanilla JavaScript · [Fuse.js](https://www.fusejs.io) · [yaml](https://eemeli.org/yaml/) · [vite-plugin-pwa](https://vite-pwa-org.netlify.app) (Workbox)

## License

[MIT](LICENSE)
