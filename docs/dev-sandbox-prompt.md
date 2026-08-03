# Prompt: build a dev sandbox for TextDiff Studio

Copy everything between the rules below into a fresh agent session. It is
written to be self-contained.

---

Build me a containerised development sandbox for a React + Vite + TypeScript
project (`Solopass/Textdiff`), running under Docker Desktop with the WSL 2
backend on Windows 11. The repo lives at `C:\Users\cohen\Documents\VS Code\textdiff-studio`.

The point is to remove specific blockers that made parts of this project
impossible to verify automatically. Please treat the blocker list as the
requirements — each one has a matching acceptance test at the end, and I want
all of them passing before you call it done.

## What kept failing, and why

These are real failures from a previous environment, not hypotheticals:

1. **No browser could be installed.**
   - `apt-get install chromium` → `Permission denied` (the shell ran as a
     non-root user with no sudo).
   - `npx @puppeteer/browsers install chrome@stable` →
     `getaddrinfo EAI_AGAIN googlechromelabs.github.io`.
   Consequence: nothing could confirm the app actually renders in a browser, or
   that the Content Security Policy in `index.html` doesn't block Monaco. A bad
   CSP white-screens the app while every test still passes.

2. **Outbound network was allowlisted to almost nothing.** npm registry worked;
   `cdn.jsdelivr.net`, `googlechromelabs.github.io` and the Playwright CDN did
   not resolve. Monaco is loaded from jsdelivr at runtime, so the single most
   fragile path in the app could not be exercised.

3. **Every shell call had a 45-second ceiling and killed background jobs.**
   Processes started with `nohup ... &` were terminated when the call returned
   (the container ran with `--die-with-parent`). Long installs and any
   long-lived server were impossible.

4. **The Windows bind mount was slow and partially read-only.**
   `npm ci` against the mounted directory exceeded 45s and left partial
   installs that then failed with `ENOTEMPTY`. `rm -rf node_modules` returned
   `Operation not permitted`, so the broken state couldn't be cleaned up.

5. **No Java, so the Firebase emulator could not run.** `firestore.rules` in
   this repo has never been tested — it is deployed on faith.

## What to build

A Docker image plus a `docker compose` setup providing:

**Runtime**
- Ubuntu 24.04 base, Node 22.x (matches `.nvmrc` and CI), npm 10+.
- A non-root user whose UID/GID maps cleanly onto the bind-mounted repo so
  files created in the container aren't root-owned on the Windows side, **and**
  which can delete files in the mount.
- `sudo` available without a password, so packages can be added later without
  rebuilding.

**Browser automation**
- Playwright with Chromium **baked into the image at build time**, not
  downloaded on first run. Use `mcr.microsoft.com/playwright:v1.4x-noble` as
  the base if that's simplest — it already ships the browsers and system
  libraries.
- Verify Chromium launches headless inside the container. Include
  `--no-sandbox` guidance if the container isn't privileged.

**Network**
- Unrestricted outbound HTTPS. At minimum these must resolve and fetch:
  `registry.npmjs.org`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`,
  `api.github.com`, `*.googleapis.com`, `github.com`.

**Filesystem and performance**
- Bind-mount the repo at `/workspace`, read-write, deletes permitted.
- Put `node_modules` on a **named Docker volume** mounted at
  `/workspace/node_modules`, so it lives on the Linux filesystem rather than
  the Windows bind mount. This is the fix for the slow-install problem — expect
  a large speedup. Note in the README that `npm ci` inside the container and
  `npm ci` on Windows then fight over the same directory, and say which one
  wins.

**Long-running processes**
- The container must stay up independently of any individual command, so a
  preview server or emulator can run in the background while other commands
  execute. `docker compose up -d` plus `docker compose exec` is fine.
- Expose ports **4173** (Vite preview), **3000** (the project's Express server),
  **5173** (Vite dev), **4000** and **8080** (Firebase emulator UI and
  Firestore).

**Firebase emulator**
- A JRE (headless is fine) and `firebase-tools`, so the Firestore emulator can
  run and `@firebase/rules-unit-testing` can exercise `firestore.rules`.
- The emulator should be startable as a separate compose service or a
  background process, and reachable from the app container.

**Convenience**
- `git`, `curl`, `jq`, `ripgrep`, `unzip`, `ca-certificates`.
- A `Makefile` or small script exposing: `make shell`, `make install`,
  `make verify`, `make browser-test`, `make emulator`.
- A `README.md` covering: first-time setup on Windows, how to rebuild, where
  `node_modules` lives and why, and how to reset a broken state.

## Constraints

- **Don't modify the application source.** Everything you add should live under
  a new `docker/` (or `.devcontainer/`) directory plus a compose file. The one
  exception: you may add npm scripts to `package.json` if a task needs them,
  but say so explicitly.
- Keep the image build reproducible — pin the Node major, the Playwright
  version, and the Ubuntu base.
- Don't bake any secrets in. `GEMINI_API_KEY` and
  `GOOGLE_APPLICATION_CREDENTIALS` should come from an env file that is
  gitignored.
- A VS Code Dev Container config is welcome but secondary to the compose setup
  working from a plain terminal.

## Acceptance tests

Write these as a single script (`docker/verify-sandbox.sh`) that exits non-zero
on any failure, and show me its output. Each one maps to a blocker above.

```
1.  node --version                      -> v22.x
2.  whoami / id                         -> non-root, and `sudo -n true` succeeds
3.  touch /workspace/.probe && rm /workspace/.probe
                                        -> succeeds (mount is writable AND deletable)
4.  time npm ci                         -> completes, and report the wall time
                                           (should be dramatically under the
                                           several-minutes it took on the
                                           Windows mount)
5.  curl -sI https://cdn.jsdelivr.net   -> HTTP 200
    curl -sI https://registry.npmjs.org -> HTTP 200
6.  npx playwright --version            -> prints a version
7.  A Playwright script that:
      - runs `npm run build:web`
      - serves `dist/` on 4173
      - opens it in headless Chromium
      - captures ALL console messages and failed network requests
      - asserts: no CSP violations ("Refused to ..."),
                 the Monaco editors mount and accept typing,
                 Ctrl+K opens the command palette,
                 a diff renders after clicking LOAD_SAMPLE then RUN_DIFF
      - saves a screenshot to docker/artifacts/
    -> all assertions pass
8.  A background process survives across separate `docker compose exec` calls
    (start something, exit, verify it's still running).
9.  java -version                       -> succeeds
10. firebase emulators:start --only firestore starts, and a trivial
    @firebase/rules-unit-testing test connects to it and passes.
```

Test 7 is the one that matters most — it is the exact gap this sandbox exists
to close. If Chromium can't run or jsdelivr can't be reached, the rest doesn't
help.

## Deliverables

- `docker/Dockerfile`
- `docker-compose.yml`
- `docker/verify-sandbox.sh`
- `docker/README.md`
- Any Makefile/scripts
- The output of `verify-sandbox.sh` showing all ten checks passing

Ask me before making anything non-obvious — but prefer a working setup over a
clever one.

---

## Context for whoever reads this later

The project already has good automated coverage: 72 tests, a typecheck gate, a
production build, and `npm run smoke`, which boots the *minified* bundle in
jsdom and verifies React mounts, the toolbar renders, the palette opens by
click and by keyboard, and a diff renders.

What none of that can do:

| Gap | Needs |
| --- | --- |
| Content Security Policy enforcement | A real browser |
| Monaco actually loading and editing | A real browser + CDN access |
| PWA installability / Lighthouse | Headless Chrome |
| Layout, overflow, responsive behaviour | A layout engine (jsdom has none) |
| `firestore.rules` correctness | Firebase emulator + Java |
| `server.ts` (Socket.IO, Gemini proxy) | Long-running processes |
| Visual regressions | Screenshots |

Once the sandbox exists, the follow-on work is: port the smoke test to
Playwright so it runs against a real browser, add rules tests against the
emulator, and add an axe accessibility pass. See `docs/NEXT-STEPS.md`.
