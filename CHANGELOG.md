# Changelog

Notable changes to TextDiff Studio. Loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-08-02

First tracked release. Consolidates a round of bug fixes, security hardening,
performance work, and new features.

### Added

- **Command palette** (`Ctrl`/`Cmd`+`K`) — fuzzy search over every major action,
  with keyboard navigation, grouped results, and shortcut hints.
- **Folder & ZIP diffing** — compare two directory trees or two `.zip` archives.
  Shows added/removed/modified/identical counts, filters by path, and opens any
  file pair in the main diff view. Read entirely in-browser.
- **Two-file drag & drop** — dropping two files at once fills both panes and
  compares immediately. Added drop-target highlighting and filename labels in the
  pane headers.
- Escape now closes every modal; previously none of them handled it.
- Busy indicator while a diff is computing (`isDiffing` was tracked but never
  rendered) and an error banner when the engine refuses an input.
- Progress state on the PNG/PDF export buttons while their libraries download.
- PWA icons (192/512/maskable), favicon, and a social preview image. The manifest
  previously had an empty `icons` array, so the app was not installable.
- SEO and social metadata: description, Open Graph, Twitter card, canonical URL.
- Content Security Policy.
- Test suite grown from 2 tests to 72: unit tests for the diff engine, folder
  comparison and palette matching, plus interaction tests that drive the real UI
  (comparison flow, command palette, overlay behaviour, persistence).
- Test infrastructure: a Monaco stand-in so editors are typeable under jsdom, and
  a Worker stand-in that runs the real diff engine. The previous Worker stub
  replied with a message shape the app rejects, so no diff could complete in a
  test.
- CI now typechecks and runs tests before deploying, and runs on pull requests.
- `docs/ARCHITECTURE.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`,
  `.nvmrc`, `.editorconfig`.

### Fixed

- **Customization settings silently reset on reload.** Six settings
  (`uiFontSize`, `uiTexture`, `uiMotion`, `customCSS`, `uiSound`, `uiGlass`) were
  read at startup but never written, and four more were missing from the save
  effect's dependency array.
- **Ignore-whitespace and ignore-case did nothing in 3-way merge mode.** The
  normalizer was defined and never applied.
- **Large comparisons could exhaust memory and kill the tab.** The LCS table is
  `(m+1)×(n+1)` 4-byte cells — two 10,000-line files wanted ~400MB, 20,000 lines
  ~1.6GB. Common prefix/suffix are now peeled off first and the table is capped,
  so oversized input reports a clear error instead of crashing. A 20,000-line
  file with one edit now completes in milliseconds.
- **`localStorage` quota errors broke the app.** Persisting two large pasted
  files exceeded the ~5MB quota and threw inside a render effect on every
  keystroke. Writes are now guarded and debounced.
- **Stale diff results could render over fresh ones.** Worker responses now carry
  a request id, handlers are attached once rather than per call, and an `onerror`
  handler prevents the UI from spinning forever after a worker crash.
- **The Custom CSS Injector never applied anything** — it wrote to state that was
  never used. Now injected via a managed `<style>` element, sanitized against
  remote fetches and full-viewport overlays.
- PDF export silently truncated anything past the first page; it now paginates.
- Normalization was being recomputed inside the diff engine's inner loop.
- `matchMedia` is now guarded for environments that lack it.
- **The command palette could not be dismissed with Escape if it was pressed
  before focus reached the input.** Focus moves in a `requestAnimationFrame`;
  Escape in that gap reached neither the palette's own handler nor the app's
  (which ignores Escape while the palette is open). Escape is now handled on a
  window capture listener, independent of focus.

### Changed

- **Similarity is now computed once, by a shared `computeDiffStats`.** The
  displayed figure changes: three lines with one edit now reads 67% rather than
  50%, because a modified line is no longer counted as both a deletion and an
  addition. Previously the worker and the UI disagreed and the UI won.
- **Share links now expire after 30 days.** Enforced by `firestore.rules` on
  create, refused by the client on read, and deleted by
  `scripts/cleanup-expired-shares.mjs`. Existing links are unaffected and never
  expire.
- **`App.tsx` split up** — module-level helpers moved to `src/lib/` (diffStats,
  highlight, sanitize, storage, constants, types), and the Monaco wrapper and
  shortcuts modal into `src/components/`. Behaviour unchanged; the suite and a
  production build verify it.
- **Initial load reduced from ~467KB to ~129KB gzipped (~72%).** Firebase,
  jsPDF, html2canvas, socket.io and the ZIP reader are now fetched only when the
  feature that needs them is used. Firestore no longer initializes on page load.
- Split view falls back to unified below 640px, preserving the stored preference.
- `package.json` renamed from `react-example`; dropped three unused dependencies
  (`motion`, `react-simple-code-editor`, `autoprefixer`) and the duplicate `vite`
  devDependency; `clean` is now cross-platform.
- README rewritten with accurate setup, scripts, and configuration.
- ROADMAP corrected — GitLab support, the community theme gallery, and the colour
  palette generator were marked complete but do not exist.

### Security

- **Firestore rules tightened.** Previously `allow read, create: if true`: the
  collection could be enumerated and written to without limit. Now `get` only
  (no `list`), a ~900KB size cap, a pinned document shape, and no updates or
  deletes. **These must be deployed separately** — see `SECURITY.md`.
- **`server.ts` hardened** — Socket.IO CORS restricted to `ALLOWED_ORIGINS`
  (was `*`), the unauthenticated Gemini proxy rate limited to 10 req/IP/min with
  input validation and a 1MB body cap, and errors made generic so upstream SDK
  messages can't leak request URLs or key fragments.
- Custom CSS from imported presets is sanitized before injection.
- HTML escaping extended to quote characters.

### Removed

- Nine stray `.patch` files, three ad-hoc test scripts, and `test-minimap.tsx`
  from the repository root. Tailwind had been scanning the patch files and
  generating CSS for classes that only existed inside those diffs.
- `bun.lock` — the project builds with npm, and a second lockfile invites drift.

### Known gaps

- `src/App.tsx` remains ~3,750 lines. Further reduction requires threading state
  into extracted components.
- Shared diffs remain public to anyone holding the link for their 30-day life;
  there is no way to revoke a specific link early.
- Multiplayer and AI resolution require a backend that is not deployed.
