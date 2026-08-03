# TextDiff Studio — Roadmap

Status is tracked against what actually ships in `main`. A previous version of
this file marked several items complete that were never built (GitLab support,
the community theme gallery, the colour palette generator); those have been
moved back to "planned" so this file can be trusted.

## ✅ Shipped

### Core diffing

- **Line diff engine (LCS)** — runs in a Web Worker. Common leading/trailing
  lines are peeled off before the quadratic step, and the DP table is capped so
  a pathological input reports an error instead of exhausting memory.
- **Word/token-level highlighting** within changed line pairs.
- **Split and unified views**, with automatic fallback to unified below 640px.
- **3-way merge / Git conflict resolver** — paste `<<<<<<< HEAD` markers and the
  three panes populate automatically.
- **Comparison filters** — ignore whitespace, ignore case, trim blank lines.
  These apply to both 2-way and 3-way modes.
- **Fold unchanged lines** to context only.

### Files and bulk comparison

- **Drag & drop** — one file per pane, or drop two at once to fill both sides.
  Binary files and files over 15MB are rejected with a message.
- **Folder & ZIP diffing** — compare two directory trees or two archives; shows
  added / removed / modified / identical counts with a path filter, and opens
  any pair in the main diff view. Read entirely in-browser.
- **GitHub repository browsing** — open files from a repo via the GitHub API.

### Sharing and history

- **Compressed URL fragments** — fully client-side, nothing leaves the browser.
- **Permanent links** backed by Firestore, with an optional note attached to the
  whole comparison.
- **GitHub Gist sync** via a personal access token.
- **Local history** — the last 20 comparisons, stored in the browser.

### Export

- HTML, PNG (html2canvas), PDF (jsPDF, paginated), and raw JSON.

### Interface

- **Command palette** (`Ctrl/Cmd+K`) with fuzzy search over every major action.
- **Keyboard shortcuts** — run, swap, palette, escape-to-close.
- **Installable PWA** with offline support.
- **Customization** — syntax themes, UI tint, radius, font family, three font
  sizes, background textures, motion toggle, glassmorphism, sound effects, and a
  custom CSS injector.
- **Preset save/load** and theme JSON import/export.
- **Integration test suite** in the Settings pane.

### Engineering

- Code splitting: initial load ~130KB gzipped; Firebase, jsPDF, html2canvas,
  socket.io and the ZIP reader are fetched on demand.
- Unit tests for the diff engine, folder comparison, and palette matching.
- CI gates the deploy on typecheck and tests.

## 🚧 Requires a backend

`server.ts` (Express + Socket.IO + a Gemini proxy) is **not** deployed by the
GitHub Pages workflow, so these are disabled in the live build. They work when
that backend is hosted and `VITE_ENABLE_SERVER_FEATURES=true` is set at build
time.

- **Live collaboration (multiplayer)** — shared editing over WebSockets.
- **AI-assisted resolution** — Gemini suggests conflict resolutions.

## 📋 Planned

### High value

- [ ] **Inline editing in the diff view** — edit directly in the unified/split
      output with the diff recomputing live.
- [ ] **Move detection** — recognise a relocated block as a move rather than a
      delete plus an add.
- [ ] **Adjustable fold context** — currently fixed; let the user choose how many
      surrounding lines to keep.
- [ ] **Per-line comments on shared diffs** — today a share carries one note for
      the whole comparison, not per-line annotations.

### Larger efforts

- [ ] **Semantic (AST-based) diffing** — understand structure so a moved function
      reads as a move. Language-specific and a significant undertaking.
- [ ] **Self-hosted backend** — a Docker image for the sharing/sync/multiplayer
      backend.
- [ ] **GitLab and Bitbucket integration** — only GitHub is supported today.

### Customization

- [ ] **Community theme gallery** — browse and install themes made by others.
      Themes can currently be shared as JSON, but there is no gallery.
- [ ] **Colour palette generator** — derive a full theme from one hex value or an
      uploaded image.
- [ ] **Finer typography control** — line height and letter spacing. Only three
      preset font sizes exist today.

### Engineering

- [ ] **Split up `App.tsx`** — still around 4,000 lines and most of the app.
- [ ] **Component and interaction tests** — current coverage is the pure logic
      plus two render smoke tests; the UI flows are untested.
- [ ] **Automated accessibility checks** in CI.
