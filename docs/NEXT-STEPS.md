# Next steps

A working checklist, ordered. Each task says how to know it actually worked —
that matters more than the steps themselves.

Baseline as of writing: 72 tests passing, typecheck clean, production build
green, initial load ~132KB gzipped.

---

## 0. Ship what's already built

Nothing below matters until this is out. There are ~57 changed or new files
sitting uncommitted.

### 0.1 — Smoke test in a real browser

The test suite covers logic and interaction under jsdom. It cannot catch a
broken Content Security Policy, and a bad CSP white-screens the app without
failing a single test. This step exists for that.

```bash
npm ci
npm run typecheck && npm test && npm run build:web
npm run preview
```

Open the preview URL and, with devtools console visible, check:

- [ ] **Console is free of `Refused to load…` / CSP violations.** This is the
      main thing you're here for.
- [ ] **Both editors render and accept typing.** Confirms Monaco survived the
      CSP — it loads from a CDN and spawns blob workers, the most fragile part.
- [ ] `Ctrl`/`Cmd`+`K` opens the command palette; typing `expdf` finds
      "Export as PDF"; `Esc` closes it.
- [ ] Drop two text files onto the editors — both panes fill and a diff runs.
- [ ] Palette → "Compare folders or ZIP archives" → pick two folders → the file
      list appears and OPEN loads a pair.
- [ ] Run a diff, then Export PDF and Export PNG. Both download. (These fetch
      their libraries on demand, so this also proves the lazy loading works.)
- [ ] Resize below 640px — the diff switches to unified and nothing overflows
      horizontally.

If anything fails, the likely culprit is `index.html`. Note the exact console
message before changing anything.

### 0.2 — Deploy the Firestore rules

**Order matters.** The new rules *require* an `expiresAt` field that only the
new client sends. Deploy the rules with or after the app, never before, or
sharing breaks for everyone on the old build.

```bash
firebase deploy --only firestore:rules
```

Verify: create a share link from the deployed site and open it in a private
window. If you get `PERMISSION_DENIED`, the rules and the client are out of
sync — check that the deployed app is the new one.

### 0.3 — Push

```bash
git add -A
git commit -m "Fix diff engine correctness and memory, harden sharing, add folder diff and command palette"
git push origin main
```

CI runs typecheck → tests → build, and blocks the deploy if any fail.

### 0.4 — Note the similarity change in your release notes

Similarity now reads **67%** where it used to read 50% for three lines with one
edit. It's a fix — a modified line was being counted as both a deletion and an
addition — but to anyone who has used the tool before it will look like a bug.
One sentence is enough.

### 0.5 — Schedule the share cleanup

Expiry is enforced in three places, but nothing *deletes* until this runs.

```bash
npm install firebase-admin        # server-only; deliberately not a project dep
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
node scripts/cleanup-expired-shares.mjs --dry-run
```

Once the dry run looks right, drop `--dry-run` and schedule it daily (GitHub
Actions on a cron, Cloud Scheduler, or a plain crontab). Daily is ample for a
30-day TTL.

Note: documents created before expiry shipped have no `expiresAt`, are invisible
to the cleanup query, and never expire. Delete them once by hand if you care.

---

## 1. Self-host Monaco

**Why this is first.** Monaco currently loads from `cdn.jsdelivr.net` at
runtime. If that CDN is blocked — corporate proxy, region, or an outage — the
editors never load and the app is unusable. Self-hosting also lets you delete
jsdelivr from four CSP directives, which is the most complicated part of that
policy and the thing most likely to break on a future change.

**Cost.** Monaco is large. Expect the initial download to grow unless you keep
it lazy. Measure before and after.

### Steps

1. Add Monaco explicitly. It's currently in `node_modules` only as an
   auto-installed peer (0.56.0), while the CDN serves a *different* version
   (0.55.1). Pinning it removes that mismatch.

   ```bash
   npm install monaco-editor@0.56.0
   ```

2. In `src/components/EditorPane.tsx`, point the loader at the bundled copy
   before any editor mounts:

   ```ts
   import * as monaco from "monaco-editor";
   import { loader } from "@monaco-editor/react";

   loader.config({ monaco });
   ```

3. Monaco needs its language/JSON/CSS workers. With Vite, the usual approach is
   `MonacoEnvironment.getWorker` returning `new Worker(new URL(...), { type: "module" })`
   for each worker entry point. If that proves fiddly, `vite-plugin-monaco-editor`
   handles the wiring.

4. Once nothing loads from the CDN, strip jsdelivr from the CSP in `index.html`
   — it appears in `script-src`, `style-src`, `font-src`, and `connect-src`
   (lines 38–43), plus the explanatory comment above them.

### How you know it worked

```bash
npm run build:web
grep -rc "jsdelivr" dist/assets/*.js   # expect 0 everywhere
```

Then load the preview with devtools **Network** open and filter for
`jsdelivr` — there must be zero requests. Also check the initial payload didn't
balloon:

```bash
grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' dist/index.html | sort -u \
  | sed 's|^|dist/|' | while read f; do gzip -c "$f" | wc -c; done \
  | awk '{s+=$1} END {printf "%.1f KB gzipped\n", s/1024}'
```

If that number jumped a lot, Monaco ended up in the entry chunk — it needs to
stay behind the lazy boundary. See the code-splitting section in
`ARCHITECTURE.md`; naming a chunk does not make it lazy.

Update `ARCHITECTURE.md` (the CSP section says jsdelivr is required *because of*
Monaco) and `SECURITY.md` when this lands.

---

## 2. Accessibility checks in CI

Cheap now that the interaction harness exists. Maybe an hour.

1. `npm install -D vitest-axe`
2. Add a test that renders the studio view and asserts no violations:

   ```ts
   import { axe } from "vitest-axe";
   // render, then:
   expect(await axe(container)).toHaveNoViolations();
   ```

   Mock Monaco the same way the other interaction tests do.
3. Cover the main view plus each modal (shortcuts, history, folder diff, command
   palette).

**Expect failures on the first run** — that's the point. Fix what it finds, or
document what you're deliberately ignoring.

Specifically unverified today: **focus trapping in modals.** Nothing stops Tab
from moving focus behind an open dialog, and no test would catch a regression.

---

## 3. Delete or wire up `CloudSyncModal`

Five minutes. `src/components/CloudSyncModal.tsx` is imported by `App.tsx` and
never rendered — it was dead before this round of work and still is. Either give
it a trigger or delete the file and its import. Right now it's just misleading.

Verify with `npm run typecheck && npm test`.

---

## 4. Continue splitting `App.tsx`

3,755 lines, down from 4,324. The easy extractions are done; what remains needs
state threaded into components, which carries real regression risk.

Suggested order, easiest first — each is a self-contained JSX block whose state
dependencies are narrow:

1. **History modal** — needs `history`, `setHistory`, and a restore callback.
2. **Git conflict resolver modal** — needs `gitConflictText` and its setter.
3. **Stats banner** — takes `stats` as a prop; nearly pure.
4. **Toolbar** — the widest surface. Do it last, and consider grouping the
   options into a single object rather than passing ~20 props.

**Method that worked well:** extract by line range programmatically rather than
retyping, run `npm run typecheck && npm test` after each single extraction, and
commit between them. Don't batch — if 72 tests go red you want to know which
move did it.

---

## 5. Inline editing in the diff view

The highest-value unbuilt feature, and genuinely hard: edit directly in the
unified/split output with the diff recomputing live. Needs the virtualized rows
to become editable and a debounce back into the worker.

Do this after 1–4. It touches the most complex part of the UI, and you'll want
the a11y checks and a smaller `App.tsx` in place first.

---

## Standing rules

Learned the hard way during this work:

- **Break your test and watch it fail** before trusting it. A line-number test
  here passed against a deliberately reintroduced bug because its input never
  reached the relevant branch.
- **Check what `dist/index.html` references** after any dependency or config
  change. A chunk being *named* separately doesn't mean it loads lazily — an
  earlier config shipped 580KB of export libraries to every visitor while
  looking correctly split in the build output.
- **The browser pass isn't optional** for changes to `index.html`,
  `vite.config.ts`, or anything touching Monaco. Tests can't see a CSP.
- **Adding a persisted setting is three edits**: the `tds_config` payload, the
  loader that reads it back, and the effect's dependency array. These drifted
  once and silently reset six settings on every reload.
