# CLAUDE.md

## Project Overview

**Zero-State** is a Chrome Extension (Manifest V3) that replaces the New Tab page with a customizable link and notes organizer. Users can create hierarchical lists of links and notes, organized as trees. Built with TypeScript and VanJS.

- **Chrome Web Store**: [zero-state](https://chromewebstore.google.com/detail/zero-state/diloncejoolaamlldicgmhimamhecipj)
- **Repository**: https://github.com/nmai/zero-state

## Build & Development Commands

```bash
npm run build        # Bundle with esbuild → dist/app.js (with sourcemaps)
npm run build-min    # Bundle minified → dist/app.js
npm run watch        # Watch mode for development
npm run pkg          # Copy manifest, static assets, and dist into pkg/ for publishing
```

There is no test suite, linter, or CI/CD pipeline configured.

## Architecture

### Tech Stack

- **TypeScript** 5.8 with strict mode, targeting ES2019
- **VanJS** 1.5.3 — ultralight (~5kb) reactive UI framework
- **esbuild** — bundler
- **Chrome APIs** — `chrome.storage.sync`, `chrome.permissions`, `chrome.runtime`

### Source Layout (`ts/`)

| File | Role |
|------|------|
| `app.ts` | Entry point. Main UI rendering, event handlers, keyboard shortcuts |
| `app.state.ts` | Centralized reactive state (`AppState` class with static VanJS states) |
| `types.ts` | TypeScript interfaces (`LinkNodeFlat`, `LinkNode`, `Settings`, etc.) |
| `constants.ts` | Constants and SVG icon strings |
| `van.ts` | VanJS re-exports |
| `edit.component.ts` | Edit/add form component |
| `settings.component.ts` | Settings modal component |
| `footer.component.ts` | Footer with messaging/prompts |
| `storage.service.ts` | Chrome storage sync API wrapper |
| `tree.service.ts` | Builds tree structure from flat node array |
| `favicon.service.ts` | Favicon provider management and caching |
| `theme.service.ts` | Theme application (light/dark/system) |
| `validator.service.ts` | Input validation |

### Static Assets (`static/`)

- `index.html` — single-page entry point, loads `dist/app.js`
- `css/custom.css` — main styles with CSS custom properties for theming
- `css/tree-list.css` — tree structure styling
- `icons/` — extension icons at various sizes
- `json/initial-data-2.0.0.json` — default data for new installs

### Data Flow

```
Chrome Storage ↔ StorageService ↔ AppState (reactive) ↔ Components ↔ DOM
```

- Data is stored as a **flat array** of `LinkNodeFlat` objects with parent references
- `TreeService.buildTree()` converts flat data into a nested `LinkNode` tree for rendering
- `AppState` holds reactive VanJS `state()` values; components derive from these
- Changes flow back through `StorageService` which writes to `chrome.storage.sync`

### Chrome Storage Constraints

See `notes.md` for details. Key limits:
- 512 items max
- 100kb total across all keys
- 8kb per key
- All node data is stored under a single key (`links-v1`)

## Code Conventions

### Naming

- **PascalCase** for classes: `StorageService`, `EditForm`, `TreeService`
- **camelCase** for methods and variables
- **UPPER_SNAKE_CASE** for constants: `CURRENT_LIST_VERSION`, `DOM_CLASSES`

### File Naming

- `.service.ts` suffix for service modules (data/logic layer)
- `.component.ts` suffix for UI components
- `.state.ts` suffix for state management

### Patterns

- Service classes use **static methods** (no instantiation)
- Components encapsulate UI logic and return VanJS DOM elements
- Async/Promise-based Chrome API interactions
- Immutable state updates (spread operator for arrays/objects)
- `nameToIndexMap` cache for O(1) lookups by item name
- Error handling: try-catch with console logging, user alerts for critical errors, revert-on-failure for optimistic updates

### CSS

- CSS custom properties for theming (`--bg-color`, etc.)
- `light-dark()` CSS function with `prefers-color-scheme` media query
- Lowercase hyphenated class names (`tree-list`, `edit-node-btn`)

## Key Features in Code

- **Tree visualization**: hierarchical lists with collapsible parent-child nodes
- **Edit mode**: toggled via `[+]` button or backtick key
- **Task completion**: right-click to strikethrough (optional setting)
- **Favicon support**: multiple providers (Chrome cache, DuckDuckGo, generic icon)
- **Theme support**: light, dark, or system preference
- **Keyboard shortcuts**: Escape (close/exit), backtick (toggle edit mode)
- **Cross-device sync**: via Chrome storage sync API when user is signed in
