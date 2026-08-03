# TextDiff Studio ⚡

> Fast, client-side text and code comparison with side-by-side and unified diff views.

![Build](https://img.shields.io/badge/Status-Active-brightgreen.svg)
![Framework: React](https://img.shields.io/badge/Framework-React-blue.svg)

**Live site:** https://solopass.github.io/Textdiff/

## Overview

**TextDiff Studio** lets developers, writers, and students run rapid line-by-line
text and code comparisons. The diff engine uses a Longest Common Subsequence
(LCS) algorithm to compute additions, deletions, and a structural similarity
score.

Diffing runs entirely in your browser — text you paste is never uploaded unless
you explicitly create a share link.

This is the **React, Tailwind CSS, & Vite** version of TextDiff Studio.

## Features

- 🌓 **Dual view modes** — split side-by-side or unified single-column.
- ⚙️ **Comparison filters** — ignore whitespace, ignore case, and trim blank lines.
- 🚀 **Web Worker diff engine** — the LCS pass runs off the main thread so the UI
  stays responsive. Common leading/trailing lines are skipped before the
  quadratic step, so large files with localized edits stay fast. Very large
  comparisons where nearly every line differs are refused with a clear message
  rather than exhausting memory.
- 💻 **Monaco editors** — syntax highlighting, line numbers, minimaps.
- 🔀 **Merge B to A** — one-click merge into your baseline, snapshotted to history.
- 🎨 **Syntax highlighting** — PrismJS across JavaScript, TypeScript, Python, JSON.
- 🔗 **Sharing** — compressed URL fragments (fully client-side), permanent
  Firebase-backed links, or push to a GitHub Gist with a personal access token.
- 🐙 **GitHub browsing** — open files straight out of a repo via the GitHub API
  (runs in the browser; no backend required).
- 📜 **Local history** — your last 20 comparisons, stored in the browser.
- 📄 **Export** — HTML, PNG (html2canvas), or PDF (jsPDF).
- 📁 **Fold unchanged lines** — collapse unmodified sections to context only.
- 📱 **Installable PWA** — works offline once loaded.
- ⌘ **Command palette** — `Ctrl/Cmd+K` to run any action by name with fuzzy search.
- 🗂️ **Folder & ZIP diffing** — compare two directory trees or archives, see
  added/removed/modified files at a glance, and open any pair in the diff view.
  Files are read locally; nothing is uploaded.
- 🖱️ **Drag & drop** — drop a file onto either pane, or drop two files at once
  to fill both sides and compare immediately.
- 🛠️ **Integration test suite** — run functional checks from the Settings pane.

Heavy dependencies (Firebase, jsPDF, html2canvas, socket.io, the ZIP reader)
are code-split and fetched only when the feature that needs them is used, so
the initial load stays around 130KB gzipped.

### Features that require a backend

The GitHub Pages deployment serves static files only, so the features below are
**disabled there**. They need `server.ts` (Express + Socket.IO + a Gemini proxy)
running somewhere, with `VITE_ENABLE_SERVER_FEATURES=true` at build time:

- **Live collaboration (multiplayer)** — Socket.IO rooms.
- **AI-assisted conflict resolution** — proxied through the Gemini API.

See `.env.example` for the required environment variables.

## Quick start

```powershell
git clone https://github.com/Solopass/Textdiff.git
cd Textdiff
npm install
npm run dev
```

The dev server runs on http://localhost:3000.

To build and preview just the static frontend:

```powershell
npm run build:web
npm run preview
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Vite middleware + Express backend). |
| `npm run build:web` | Static frontend build only — this is what CI deploys. |
| `npm run build` | Frontend **and** the bundled Node server. |
| `npm start` | Run the bundled server from `dist/` (requires `npm run build`). |
| `npm run typecheck` | TypeScript check, no emit (alias: `npm run lint`). |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to watch). |
| `npm run clean` | Remove build output. |

## Configuration

Copy `.env.example` to `.env` and fill in what you need:

- `GEMINI_API_KEY` — required only for AI-assisted resolution.
- `VITE_ENABLE_SERVER_FEATURES` — set to `true` once a backend is reachable.
- `ALLOWED_ORIGINS` — comma-separated origins permitted to open Socket.IO
  connections. Defaults to `http://localhost:3000`.

`firebase-applet-config.json` holds the Firebase **web** config. This is a public
identifier, not a secret; access is governed by `firestore.rules`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which typechecks, runs
the test suite, builds the static frontend, and publishes it to GitHub Pages. A
failing typecheck or test blocks the deploy.

## Documentation

| Doc | What's in it |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the diff engine works, the worker protocol, and the code-splitting and CSP rules that are easy to break |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Setup, the checks CI runs, and the load-bearing details to watch |
| [`SECURITY.md`](SECURITY.md) | What leaves the browser, Firestore rules and how to deploy them, secret handling |
| [`ROADMAP.md`](ROADMAP.md) | What ships today and what's planned |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history |
| [`docs/NEXT-STEPS.md`](docs/NEXT-STEPS.md) | Ordered checklist of what to do next, with verification steps |

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: Node 22+, then
`npm run typecheck && npm test && npm run build:web` before opening a PR.

## License

Distributed under a Custom Non-Commercial Open Source License. See `LICENSE`.
