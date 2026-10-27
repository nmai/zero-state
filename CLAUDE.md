# CLAUDE.md

## Project Overview

**Zero-State** is a Chrome Extension (Manifest V3) that replaces the New Tab page with a customizable link and notes organizer. Users can create hierarchical lists of links and notes, organized as trees. Built with TypeScript and VanJS.

- **Chrome Web Store**: [zero-state](https://chromewebstore.google.com/detail/zero-state/diloncejoolaamlldicgmhimamhecipj)
- **Repository**: https://github.com/nmai/zero-state

## Build & Development Commands

```bash
npm run build        # Bundle src/app.ts with esbuild → dist/app.js (with sourcemaps)
npm run build-min    # Bundle minified → dist/app.js
npm run watch        # Watch mode for development
npm run typecheck    # tsc --noEmit (covers src/ only)
npm test             # vitest: unit tests + a jsdom smoke test (test/)
npm run test:e2e     # Playwright: drives the real extension in Chromium (e2e/)
npm run pkg          # scripts/pkg.mjs: assemble manifest, static/, dist/, _locales/ into pkg/ for the store
```

One-time setup for e2e: `npx playwright install chromium`.

To try the extension by hand, load the repo root as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked); `manifest.json` points at `static/` and `dist/`, so run a build first.

There is no linter or CI pipeline configured.

## Architecture

### Tech Stack

- **TypeScript** 5.8 with strict mode (plus `noUnusedLocals`/`noUnusedParameters`), targeting ES2022
- **VanJS** 1.5.3: ultralight (~1.2 KB gzip) reactive UI framework. Kept deliberately over Alpine.js, which can't run under MV3's CSP; see `REFACTOR_PLAN.md`
- **esbuild** 0.28: bundler
- **vitest** 3.2 + **jsdom**: unit and DOM smoke tests
- **Playwright** 1.63: end-to-end tests against the real extension
- **Chrome APIs**: `chrome.storage.sync`, `chrome.storage.onChanged`, `chrome.permissions`, `chrome.runtime`

### Source Layout

```
src/
├── app.ts                  # Bootstrap only: load storage, mount, wire storage/keyboard listeners, install window.zeroState
├── types.ts                # Interfaces (LinkNodeFlat, LinkNode, Settings, ConsoleHelpers) and FaviconProvider enum
├── constants.ts            # Storage keys, inline SVG/text icons, favicon provider labels, default settings
├── van.ts                  # VanJS re-exports (dependency isolation)
├── state.ts                # All reactive state: rawList, derived root/names, UI modes, footer messages
├── actions.ts              # Every user mutation: swap in the new list, persist, roll back on failure; export/import
├── services/
│   ├── storage.ts          # chrome.storage.sync load/save, settings merge, node normalization, first-run seed data
│   ├── tree.ts             # Pure flat-list → tree builder
│   ├── validation.ts       # URL and node-form validation (incl. parent-loop detection)
│   ├── export.ts           # Versioned export format: build and parse/validate
│   ├── favicon.ts          # Favicon URL per provider + optional "favicon" permission check/request
│   └── theme.ts            # Applies light/dark/system theme to <html>
└── components/
    ├── tree-view.ts        # Tree rendering, node content, move/delete buttons, right-click complete
    ├── side-panel.ts       # [+]/[−] toggle button and the form container
    ├── edit-form.ts        # Add/edit form with inline validation errors
    ├── settings-modal.ts   # Settings overlay
    └── footer.ts           # Footer: favicon-permission notice and [settings] link

test/                       # vitest: tree, validation, storage, export, ui (jsdom)
e2e/                        # Playwright specs; fixtures.ts has the context setup and locator helpers
scripts/pkg.mjs             # Cross-platform packaging script
```

### Static Assets

```
static/
├── index.html                      # Single-page entry point; loads ../dist/app.js
├── css/
│   ├── custom.css                  # Theme variables, layout, buttons, modal, forms, footer
│   └── tree-list.css               # Tree lines and list item layout
├── icons/
│   └── *.png                       # Extension icons at various sizes
└── json/
    └── initial-data-2.0.0.json     # Default data for new installs
```

UI icons (close, link, [+], [−], arrows) are inline strings in `ICONS` in `constants.ts`, not files.

### Data Flow

```
chrome.storage.sync ↔ services/storage.ts ↔ actions.ts ↔ state.ts ↔ components ↔ DOM
```

- Data is stored as a **flat array** of `LinkNodeFlat` objects with parent references (by name)
- `rawList` in `state.ts` is the single source of truth. `root` (the display tree, via `buildTree()`) and `names` are `van.derive`d from it, so there are no manual rebuilds
- `actions.ts` is the only place that changes `rawList` for user edits. `persistList()` snapshots the old list, swaps in the new one, saves, and restores the snapshot (with an `alert`) if the save fails
- Components call functions in `actions.ts` for anything that persists. UI-only state (`editMode`, `settingsMode`, `editingNode`, `footerMessages`) lives in `state.ts` and isn't persisted
- Sibling order is flat-list order; moving an item up/down swaps the two nodes' positions in the flat list
- Renaming a node remaps its children's `parent` references (`updateNode`)
- `storage.ts` remembers the last-saved JSON and skips writes that wouldn't change anything
- `app.ts` listens to `chrome.storage.onChanged`, so edits in other tabs or synced devices show up live
- On first run (nothing stored), the list comes from `static/json/initial-data-2.0.0.json`; it isn't written to storage until the first edit

### Chrome Storage Constraints

See `notes.md` for details. Key limits:
- 512 items max
- 100kb total across all keys
- 8kb per key
- All node data is stored under a single key (`links-v1`); settings are under `settings-v1`

**Important**: Storage contents are user data. Don't rename `LIST_STORAGE_KEY`/`SETTINGS_STORAGE_KEY` or change the stored node shape without a migration. The `FaviconProvider` enum string values (`'chrome'`, `'duck'`, `'gen'`, `'none'`) are persisted too. Never change them; doing so would break existing users' data and settings.

The console export format (`services/export.ts`) is versioned. If you change its shape, bump `EXPORT_VERSION` and keep `parseExport()` able to read the old version.

## Code Conventions

### Naming

- **PascalCase** for components (functions that return VanJS elements): `TreeView`, `SidePanel`, `EditFormPanel`, `SettingsModal`, `Footer`
- **camelCase** for functions and variables: `addNode`, `buildTree`, `validateNodeForm`
- **UPPER_SNAKE_CASE** for constants: `LIST_STORAGE_KEY`, `DEFAULT_SETTINGS`, `ICONS`, `EXPORT_VERSION`

### File Naming

- Lowercase kebab-case, no type suffixes: a module's role comes from its directory
- `services/`: logic and browser-API wrappers (no UI)
- `components/`: UI components

### Patterns

- Plain exported module functions. No static-only classes (the refactor removed them)
- Components never call `saveList`/`saveSettings` directly; they go through `actions.ts`
- Immutable state updates: always assign a new array/object/Set to `.val` (`rawList`, `settings`, `footerMessages`), never mutate in place
- Keep `services/tree.ts`, `validation.ts`, and `export.ts` pure; that's what makes them unit-testable
- Read state through `.rawVal` inside a `derive` when you don't want the dependency (e.g. the edit form reads `settings.rawVal` so a settings change doesn't wipe an in-progress edit)
- Form validation lives in `services/validation.ts` and returns a message or `null`; the form shows it inline (`.form-error`) rather than with `alert()`
- Keyboard shortcuts ignore keypresses while an input, select, textarea, or contenteditable has focus (`isTypingTarget` in `app.ts`)
- Linear lookups over the list are fine; it's capped at 512 items, so there are no index caches

### CSS

- CSS custom properties for theming, defined in `custom.css`: `:root` defaults, a `prefers-color-scheme: dark` override, and `.theme-light`/`.theme-dark` classes that `theme.ts` puts on `<html>` for an explicit choice
- `light-dark()` for a few one-off colors
- Lowercase hyphenated class names (`tree-list`, `editable-node`, `display-none`)

## Testing

- **Unit (`test/`)**: vitest. `ui.test.ts` runs under jsdom with a minimal `chrome` stub installed *before* the app modules are dynamically imported. VanJS batches DOM updates asynchronously, so tests wait (`flush()`) before asserting on the DOM
- **End-to-end (`e2e/`)**: Playwright loads the repo root as an unpacked extension in a fresh persistent Chromium profile per test and opens `chrome://newtab/`. `global-setup.ts` rebuilds `dist/app.js` first, and all external requests (favicons) are stubbed locally. Use the helpers in `fixtures.ts` (`treeItem`, `toggleEditMode`, `openSettings`, `storedList`, `storedSettings`, `openNewTab`) rather than raw selectors
- **Screenshot baselines** in `e2e/visual.spec.ts-snapshots/` are platform-specific, and only `-win32` baselines are committed. On other platforms the visual tests fail and Playwright writes new `-<platform>.png` files, so don't commit those by accident. After an intentional visual change, regenerate with `npx playwright test --update-snapshots`
- `npm run typecheck` only covers `src/`; vitest and Playwright strip types from `test/` and `e2e/` without checking them
- Not covered: the native prompt for the optional `favicon` permission, which Playwright can't click

## Key Features in Code

- **Tree visualization**: hierarchical lists with parent-child tree lines
- **Edit mode**: toggled via the `[+]` button or the backtick/tilde key
- **Task completion**: right-click to strikethrough (optional setting)
- **Favicon support**: multiple providers (Chrome cache, DuckDuckGo, generic icon, none); the Chrome cache needs the optional `favicon` permission, requested from a footer notice
- **Theme support**: light, dark, or system preference
- **Keyboard shortcuts**: Escape (close/exit), backtick/tilde (toggle edit mode)
- **Cross-device sync**: via `chrome.storage.sync` when the user is signed in, plus live updates across open tabs
- **Console backup/restore**: `copy(zeroState.exportData())` and `zeroState.importData(json)` on the New Tab page's DevTools console; imports are fully validated before anything changes
