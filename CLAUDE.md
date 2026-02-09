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

### Source Layout

```
ts/
├── app.ts                          # Entry point: initialization, keyboard shortcuts, top-level render
├── core/
│   ├── types.ts                    # Interfaces (LinkNodeFlat, LinkNode, Settings) and FaviconProvider enum
│   ├── constants.ts                # Storage keys, DOM classes, text icons, SVG loader, default settings
│   └── van.ts                      # VanJS re-exports (dependency isolation)
├── state/
│   ├── ui.state.ts                 # UI-only state (editMode, settingsMode, editingNode, footerMessages)
│   └── data.state.ts               # Persistent data state (rawList, names, root tree, settings)
├── services/
│   ├── command.service.ts          # Orchestrates state mutations + persistence (the main action layer)
│   ├── storage.service.ts          # Chrome storage sync API wrapper (load/save)
│   ├── tree.service.ts             # Builds tree structure from flat node array
│   ├── favicon.service.ts          # Favicon provider management and caching
│   ├── theme.service.ts            # Theme application (light/dark/system)
│   └── validator.service.ts        # URL validation
└── components/
    ├── tree.component.ts           # Tree rendering, node content, move/delete buttons
    ├── edit-form.component.ts      # Add/edit form with validation
    ├── settings.component.ts       # Settings modal
    └── footer.component.ts         # Footer with messaging/prompts
```

### Static Assets

```
static/
├── index.html                      # Single-page entry point
├── css/
│   ├── variables.css               # Theme CSS custom properties (light/dark)
│   ├── base.css                    # Body, links, utility classes
│   ├── layout.css                  # Flexbox layout (row, col, main-content)
│   ├── buttons.css                 # Toggle, move, edit, close buttons
│   ├── tree.css                    # Tree lines, node styles, favicons, editable highlights
│   ├── modal.css                   # Settings modal and overlay
│   ├── forms.css                   # Edit form inputs, selects, actions
│   └── footer.css                  # Fixed footer bar
├── icons/
│   ├── svg/                        # SVG icon files (edit, close, settings, link)
│   └── *.png                       # Extension icons at various sizes
└── json/
    └── initial-data-2.0.0.json     # Default data for new installs
```

### Data Flow

```
Chrome Storage ↔ StorageService ↔ CommandService ↔ DataState/UIState ↔ Components ↔ DOM
```

- Data is stored as a **flat array** of `LinkNodeFlat` objects with parent references
- `TreeService.buildTree()` converts flat data into a nested `LinkNode` tree for rendering
- `CommandService` is the single orchestration layer — components call it instead of directly touching storage or rebuilding the tree
- `UIState` holds transient UI state (edit mode, modals); `DataState` holds persistent data (list, settings)
- Changes sync across devices via `chrome.storage.sync`

### Chrome Storage Constraints

See `notes.md` for details. Key limits:
- 512 items max
- 100kb total across all keys
- 8kb per key
- All node data is stored under a single key (`links-v1`)

**Important**: The `FaviconProvider` enum string values (`'chrome'`, `'duck'`, `'gen'`, `'none'`) are persisted in storage. Never change these values — it would break settings for existing users.

## Code Conventions

### Naming

- **PascalCase** for classes: `StorageService`, `EditForm`, `TreeComponent`
- **camelCase** for methods and variables
- **UPPER_SNAKE_CASE** for constants: `CURRENT_LIST_VERSION`, `DOM_CLASSES`

### File Naming

- `.service.ts` — services (data/logic/orchestration layer)
- `.component.ts` — UI components
- `.state.ts` — state management

### Patterns

- Service classes use **static methods** (no instantiation)
- Components call `CommandService` for any action that mutates state + persists (never call `StorageService` directly from a component)
- Immutable state updates (spread operator for arrays/objects)
- `nameToIndexMap` cache in `DataState` for O(1) lookups by item name
- Optimistic updates with revert-on-failure pattern in `CommandService`
- SVG icons are loaded from files at init time via `loadSvgIcons()`, stored in `SVG_ICONS` map

### CSS

- CSS custom properties for theming (defined in `variables.css`)
- `light-dark()` CSS function with `prefers-color-scheme` media query
- Lowercase hyphenated class names (`tree-list`, `edit-node-btn`)
- One CSS file per concern (variables, layout, buttons, tree, modal, forms, footer)

## Key Features in Code

- **Tree visualization**: hierarchical lists with parent-child tree lines
- **Edit mode**: toggled via `[+]` button or backtick key
- **Task completion**: right-click to strikethrough (optional setting)
- **Favicon support**: multiple providers (Chrome cache, DuckDuckGo, generic icon)
- **Theme support**: light, dark, or system preference
- **Keyboard shortcuts**: Escape (close/exit), backtick (toggle edit mode)
- **Cross-device sync**: via Chrome storage sync API when user is signed in
