# zero-state Refactor Plan

**Branch:** `refactor/cleanup` (off `dev`)
**Date:** 2026-07-07
**Scope:** ~1,300 lines of TypeScript across 13 files in `ts/`
**Status:** ✅ Complete — all phases executed on 2026-07-07. Phases 2–5 landed
as one commit (a module-by-module rewrite made "restructure first, fix bugs
later" artificial — reintroducing known bugs into freshly written code just to
fix them a commit later serves no one). Two additional latent bugs were found
and fixed during the rewrite: renaming a parent orphaned its children (their
`parent` refs kept the old name), and a node could be made its own ancestor,
silently detaching it from the rendered tree forever.

## Context

zero-state is a Chrome MV3 extension that replaces the New Tab page with a
tree/list of links and notes, persisted via `chrome.storage.sync`. The code
works and ships, but it accumulated organizational debt:

- Every module is a static-only class (`AppState`, `StorageService`,
  `TreeService`, `FaviconService`, `ValidatorService`, `UiComponents`,
  `EditForm`) — a Java idiom that adds noise in ES modules.
- The persistence flow (`mutate state → StorageService.save → rebuild tree →
  revert on failure`) is hand-copied in 5+ call sites with inconsistent
  rollback behavior (delete never rolls back; move and toggle do).
- `TreeService.buildTree` silently writes `AppState.createdTable` as a side
  effect — and `createdTable` is never read anywhere. `AppState.names` is
  manually kept in sync with `rawList` instead of being derived.
- `app.ts` mixes bootstrapping, event wiring, and a 270-line `UiComponents`
  grab-bag class.
- Dead code: commented-out validator, commented-out close button, unused
  imports, stale `<script>` comments in `index.html`.
- `tsconfig.json` is the 13KB fully-commented default template.

### Known bugs (found during review, fixed in Phase 5)

1. **Settings merge typo** — `storage.service.ts:94`:
   `{ DEFAULT_SETTINGS, ...data }` creates a *property named*
   `DEFAULT_SETTINGS` instead of spreading it. Stored settings that predate a
   new settings key never receive its default, and the bogus key gets
   persisted back into sync storage.
2. **Hotkey fires while typing** — the `` ` ``/`~` edit-mode toggle in
   `app.ts` has no guard for focus being inside an input, so typing `~` in
   the URL field toggles edit mode mid-edit.
3. **No rollback on failed delete** — if `chrome.storage` rejects after a
   delete, `rawList` keeps the deletion but the tree is never rebuilt →
   UI and state disagree.
4. **`FaviconService.getIcon`** returns the literal string `'undefined'` for
   `None`/unknown providers (renders a broken `<img>` if ever hit), and
   `new URL(urlStr)` sits outside the `try` that's meant to guard it.
5. **Footer message Set** is mutated in place before being re-assigned
   (`footerMessages.val.delete(...)`) — works by luck, violates the
   immutable-update convention used everywhere else.
6. **`printStartupInfo`** hardcodes `"links-v1"` instead of using
   `CURRENT_LIST_VERSION`.

## Framework decision: keep VanJS, do not adopt Alpine

**Recommendation: keep VanJS 1.5.x.** Evaluated against Alpine.js as requested:

| Criterion | VanJS (current) | Alpine.js |
|---|---|---|
| MV3 CSP compatibility | Clean — no eval anywhere | **Blocked**: core evaluates `x-on`/`x-data` expressions via `new Function()`, which MV3's mandatory `script-src 'self'` (no `unsafe-eval`) forbids. The special CSP build works but disallows inline expressions entirely — only bare method references — erasing Alpine's main ergonomic advantage. |
| Rendering model | Data-driven functional components; recursive tree rendering is natural | Progressive enhancement of existing HTML; recursive structures require awkward nested `x-for`/template tricks |
| Size | ~1.2 KB gzip, zero transitive deps | ~15 KB gzip |
| Migration cost | Zero | Full rewrite of every component |

The pain in this codebase is *structural* (static classes, duplicated
persistence logic, dead state), not framework-caused. VanJS's reactive
`state`/`derive` primitives are a good fit and stay. Svelte (an abandoned
`svelte` branch exists) was also considered and rejected: it adds a compiler
and component-file toolchain that a 1.3K-line extension doesn't need.

## Target structure

```
src/
  app.ts                  bootstrap only: load storage, mount, wire listeners
  types.ts                shared interfaces/enums
  constants.ts            storage keys, icons, defaults
  van.ts                  VanJS re-exports
  state.ts                reactive state + derived values (root, names)
  actions.ts              ALL user mutations: mutate → persist → rollback on error
  services/
    storage.ts            chrome.storage wrapper (load/save/merge defaults)
    tree.ts               pure flat-list → tree builder (no side effects)
    favicon.ts            favicon URL resolution + permission flow
    theme.ts              theme application
    validation.ts         node form validation (centralized)
  components/
    tree-view.ts          tree/list rendering
    edit-form.ts          add/edit form
    settings-modal.ts     settings overlay
    footer.ts             footer + notices
    side-panel.ts         toggle button + form container
test/
  tree.test.ts            tree building: parents, orphans, ordering
  validation.test.ts      form validation rules incl. cycle detection
  storage.test.ts         settings merge with defaults, node normalization
  ui.test.ts              jsdom smoke test: reactive render + right-click flow
```

## Phases

### Phase 0 — Baseline & tooling
- [x] Create branch `refactor/cleanup` from `dev`; commit this plan
- [x] Replace 13KB template `tsconfig.json` with a minimal strict config
      (`noEmit`, `noUnusedLocals`, `noUnusedParameters`, `include: ["src"]`)
- [x] `package.json`: move `typescript` to devDependencies, bump `esbuild`
      to 0.28.x (open dependabot suggestion), drop stale `main` field,
      add `private: true`, add `typecheck` script
- [x] Verify: `npm run build` + `npx tsc --noEmit` green before any code moves

### Phase 1 — Framework decision
- [x] Evaluate VanJS vs Alpine (and Svelte) — **keep VanJS** (rationale above);
      no code change

### Phase 2 — Restructure & idiom cleanup
- [x] Move `ts/` → `src/` with the target layout above; update build scripts
- [x] Convert every static-only class to plain module functions
- [x] Delete dead code: `createdTable` state, commented-out validator,
      commented-out close button, unused imports, stale comments in
      `index.html`
- [x] Make `tree.ts` pure — no `AppState` writes, no JSON-string memo cache
      (the list is ≤512 items; rebuild cost is trivial)

### Phase 3 — Data flow: single mutation path
- [x] `state.ts`: `root` and `names` become `van.derive`d from `rawList` —
      no more manual rebuild calls or `updateNames()` bookkeeping;
      drop `nameToIndexMap` (linear lookup is fine at this scale)
- [x] `actions.ts`: `addNode`, `updateNode`, `removeNode`, `moveNode`,
      `toggleComplete`, `updateSettings` — each snapshots `rawList`,
      applies the change, persists, and restores the snapshot on failure.
      Replaces all copy-pasted save/rebuild blocks and fixes bug #3

### Phase 4 — Component decomposition
- [x] Split `UiComponents` into `tree-view.ts` / `side-panel.ts`; components
      become plain functions
- [x] Break up the 240-line `EditForm.renderAddForm` into form-state helpers +
      render; use `settings.rawVal` in the populate-derive so unrelated
      settings changes don't clobber an in-progress edit
- [x] Move all form validation into `services/validation.ts` (replaces the
      commented-out `ValidatorService` block); show errors inline in the form
      instead of `alert()`

### Phase 5 — Bug fixes & small enhancements
- [x] Fix settings merge spread typo (#1)
- [x] Guard hotkeys against firing while an input/select/textarea has focus (#2)
- [x] Fix `getIcon` fallbacks + move `new URL` inside the guard (#4)
- [x] Immutable footer-message updates (#5)
- [x] Use `CURRENT_LIST_VERSION` constant in `printStartupInfo` (#6)

### Phase 6 — Tests, verification & docs
- [x] Add `vitest` (+ `jsdom` if a DOM test proves easy); unit tests for
      tree building, validation, settings merge
- [x] Verify: `npm run build`, `npm run typecheck`, `npm test` all green;
      bundle size compared against pre-refactor 42.2 KB
- [x] Update README dev section (build/watch/typecheck/test/pkg)

## Out of scope (possible follow-ups)

- Drag-and-drop reordering (replacing ↑/↓ buttons)
- Splitting storage across multiple sync keys to raise the 8KB-per-item ceiling
  (see `notes.md`)
- Checklist feature completion
- CI workflow (GitHub Actions running build + typecheck + tests)

## Risks

- **No existing tests** — mitigated by refactoring in small commits, keeping
  behavior identical except for the documented bug fixes, and adding tests in
  Phase 6.
- **Storage format is user data** — the flat `links-v1` schema and
  `settings-v1` key are *not* touched; only code organization changes.
- **Manual QA still required** — a Chrome extension can't be fully exercised
  headlessly; final check is loading `pkg/` as an unpacked extension.
