# Architecture

How TextDiff Studio fits together, and — more importantly — the decisions that
look wrong until you know why they're there. If you're about to "clean up"
something in this document, read the reasoning first.

## Shape of the app

```
index.html          CSP, SEO/social meta, service worker registration
  └── src/main.tsx
        └── src/App.tsx           ~3,750 lines: state, toolbar, diff render
              ├── diffWorker.ts   the diff engine (runs off the main thread)
              ├── firebase.ts     lazily initialised Firestore accessor
              ├── lib/
              │     ├── diffStats.ts   DiffRow/WordPart types + computeDiffStats
              │     ├── highlight.ts   Prism highlighting + HTML export
              │     ├── sanitize.ts    escapeHtml, sanitizeCustomCss
              │     ├── storage.ts     safeSetItem
              │     ├── constants.ts   feature flags, share TTL
              │     └── types.ts       shared type re-exports
              └── components/
                    ├── EditorPane.tsx       Monaco wrapper
                    ├── ShortcutsModal.tsx   keyboard reference
                    ├── CommandPalette.tsx   Ctrl+K palette (+ fuzzyScore)
                    ├── FolderDiff.tsx       folder/ZIP comparison (+ compare, stripRoot)
                    ├── GitHubIntegration.tsx
                    ├── MultiplayerMode.tsx
                    ├── SettingsPage.tsx
                    ├── LandingPage.tsx
                    └── CloudSyncModal.tsx   (imported but not currently rendered)
scripts/
  └── cleanup-expired-shares.mjs   deletes expired share documents (Admin SDK)
server.ts           Express + Socket.IO + Gemini proxy. NOT deployed to Pages.
```

`App.tsx` still holds most of the UI. It was ~4,300 lines; the module-level
helpers and the two self-contained components above have been lifted out.
Further reduction means threading state into extracted components, which is
tracked in `ROADMAP.md`.

### Why `lib/diffStats.ts` is separate from `diffWorker.ts`

The UI needs `computeDiffStats`. Importing it from `diffWorker.ts` pulls the
LCS engine and `node-diff3` into the main bundle — about 3KB gzipped of code
that only ever executes inside a Web Worker. Tree-shaking does not remove it,
because the module has side effects and shared internals.

`lib/diffStats.ts` therefore holds the row types and the stats function and
imports nothing. **Do not add an import of the engine to it**, or that
regression returns silently.

## The diff engine

Lives in `src/diffWorker.ts`. Everything below runs in a Web Worker so a large
comparison never blocks the UI.

### Line diff — `computeLCS`

A standard Longest Common Subsequence dynamic program, with three things layered
on top that matter for correctness and survival:

**1. Normalisation is precomputed.** The ignore-whitespace/ignore-case options
are applied once per line up front (`aNorm`, `bNorm`). They used to be applied
inside the O(m×n) inner loop, which meant a 5,000×5,000 comparison performed 25
million `trim`/regex/`toLowerCase` calls and spent most of its time there.

**2. Common prefix and suffix are peeled off first.** Real edits touch a small
region of a file. Emitting the untouched head and tail directly shrinks the
quadratic core to just the edited span. This is what makes a 20,000-line file
with one changed line feasible.

> **If you touch this, watch the line numbers.** The DP runs over the *trimmed*
> middle, so indices coming out of it are relative to that slice and must be
> shifted by `prefix` to land back in the original file's coordinates. Getting
> this wrong produces a diff that looks right but reports wrong line numbers.
> `src/diffWorker.test.ts` guards it specifically.

**3. The DP table is capped.** `MAX_DP_CELLS = 12_000_000`. The table is
`(m+1)×(n+1)` `Int32Array` cells at 4 bytes each, so two 10,000-line files with
nothing in common would want ~400MB and 20,000 lines would want ~1.6GB — enough
to kill the tab. Past the cap the worker throws `DiffTooLargeError`, which the UI
surfaces as a readable message. Prefix/suffix peeling means normal inputs never
approach this.

### Token diff — `computeTokenDiff`

The same DP, per changed line pair, for intra-line highlighting. Its cap
(`MAX_TOKEN_DP_CELLS = 1_000_000`) is much tighter because it runs once per
changed pair and a single minified line can hold tens of thousands of tokens.
Over the cap it returns undefined parts and the row renders as a plain add/del.

### 3-way merge — `compute3Way`

Wraps `node-diff3`. The ignore flags are applied by normalising the input arrays
before handing them over, with a `Map` back to the original strings so the
rendered output shows what the user typed rather than the lowercased,
whitespace-collapsed form.

> These flags were accepted and silently discarded here for a long time —
> `normalize` was defined and never called. There's a regression test for it.

### Statistics

`computeDiffStats` (in `lib/diffStats.ts`) is the single source of truth, used
by both the worker and the UI.

Similarity is `unchanged / max(linesA, linesB)`, where the line counts are
recovered from the rows themselves — every A-side row is unchanged or a
deletion, every B-side row is unchanged or an addition.

> This was previously computed twice with different formulas. The worker sent
> `unchanged / max(lenA, lenB)`; `App.tsx` ignored that field and recomputed
> `unchanged / (adds + dels + unchanged)`, which double-counts a modified line
> (once as a deletion, once as an addition) and reported 50% where the worker
> said 67%. The displayed figure was the wrong one.

### Worker protocol

```
main → worker   { requestId, orig, mod, base, isThreeWay, ws, caseInsensitive, trimBlanks }
worker → main   { requestId, rawDiff, stats }        on success
worker → main   { requestId, error }                 on failure
```

`requestId` is a monotonic counter. The main thread ignores any response whose id
isn't the current one, because a slow run can otherwise land after a newer one
and render a stale diff over fresh output.

Handlers are attached **once**, when the worker is created — not per call. The
worker also has an `onerror` handler; without it a crash leaves `isDiffing` stuck
true and the UI spinning with no way to recover.

`diffWorker.ts` only installs `self.onmessage` when it detects a real worker
context, so the pure functions can be imported directly by tests.

## Code splitting — read before editing `vite.config.ts`

Initial load is ~130KB gzipped. It was ~467KB. That difference is entirely about
**how modules are imported**, and it is easy to undo by accident.

**Naming a chunk in `manualChunks` does not make it load lazily.** Laziness comes
from `import()` at the call site and nothing else. Worse, forcing a library into
a manual chunk can pull it into the entry's static graph, where Vite emits a
`<link rel="modulepreload">` for it — so the browser downloads it eagerly anyway.
An earlier version of this config did exactly that and shipped ~580KB of export
libraries to every visitor while *looking* correctly split in the build output.

So: `manualChunks` groups React only. Everything heavy is kept async by how it's
imported:

| Dependency | Loaded when | Mechanism |
| --- | --- | --- |
| `firebase/*` | first share, or opening a permanent link | `getDb()` in `src/firebase.ts` |
| `jspdf`, `html2canvas` | PNG/PDF export is clicked | `import()` inside the export handlers |
| `socket.io-client` | multiplayer panel opens | `React.lazy(MultiplayerMode)` |
| `fflate` | a ZIP is selected | `import()` in `buildMapFromZip` |
| `FolderDiff`, `GitHubIntegration` | their panel opens | `React.lazy` |

**To verify a change didn't regress this**, don't trust the chunk list — check
what the entry HTML actually references:

```powershell
npm run build:web
.\scripts\Check-Bundle.ps1
```

That script lists exactly what the entry HTML pulls in, with gzipped sizes, and
fails if any of firebase / jspdf / html2canvas / socket.io has stopped being
lazy. On a non-Windows shell:

```bash
grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' dist/index.html | sort -u
```

Anything listed there (including `modulepreload` hints) is downloaded on first
paint. `vendor-react`, the app chunk, and the CSS belong. Firebase, jspdf,
html2canvas and socket.io do not.

## Content Security Policy

Set via `<meta>` in `index.html` because GitHub Pages can't set response headers.

Monaco is fully self-hosted (`monaco-editor` 0.56.0). The editor and its language
web workers (`editor`, `json`, `css`, `html`, `ts`) are bundled locally with dynamic
import chunking, completely eliminating the previous runtime dependency on `cdn.jsdelivr.net`.
As a result, `jsdelivr` has been stripped from `script-src`, `style-src`, `font-src`,
and `connect-src`.

`'unsafe-inline'` is required in `style-src` (Tailwind v4 and Monaco inject
styles at runtime; the custom-CSS feature writes a `<style>` element).
`'unsafe-eval'` is deliberately **not** granted — no bundled dependency calls
global `eval` or `new Function`. If you add a dependency that does, prefer
replacing it over loosening this.

`frame-ancestors` is intentionally absent: it is ignored in a `<meta>` CSP and
would be false assurance. Clickjacking protection needs a real header, which
means a host that can set them.

## Client-side storage

All under a `tds_` prefix in `localStorage`: `tds_origText`, `tds_modText`,
`tds_config`, `tds_history`, `tds_presets`, `tds_github_token`.

Two rules:

1. **Writes go through `safeSetItem`.** The quota is ~5MB and two large pasted
   files blow past it; an unguarded `setItem` throws inside a render effect and
   breaks the app on every subsequent keystroke.
2. **The save and load key lists must stay in sync.** They drifted apart once and
   six customization settings were read but never written, so they silently reset
   on every reload. If you add a setting, add it to *both* the `tds_config`
   payload and the loader, and to the effect's dependency array.

## Sharing

Two paths:

- **URL fragment** — `lz-string` compresses the payload into the hash. Entirely
  client-side; the data never leaves the browser.
- **Firestore** — writes `{ data, timestamp, expiresAt }` to the `diffs`
  collection and puts the document id in `?id=`.

### Expiry

Share links live for `SHARE_TTL_DAYS` (30, in `lib/constants.ts`). Three layers,
because no single one is sufficient:

1. **The client writes `expiresAt`** and tells the user when the link dies.
2. **`firestore.rules` requires it** on create and caps it at ~31 days, so a
   hand-rolled request cannot mint a link that outlives the policy.
3. **`scripts/cleanup-expired-shares.mjs`** actually deletes expired documents.
   Rules deny deletes to every client, so this runs with the Admin SDK.

The read path refuses an expired document independently of whether cleanup has
run — a document can outlive its expiry between job runs. Links created before
expiry shipped have no `expiresAt` and are treated as non-expiring.

The client checks the payload against the same ~900KB ceiling the rules enforce,
so an oversized share produces a clear message instead of an opaque
`PERMISSION_DENIED`. If you change the payload shape, `firestore.rules` pins the
allowed keys and must change with it — see `SECURITY.md`.

## Testing

`npm test` (Vitest + jsdom). 72 tests across two layers.

**Unit — pure logic:**

- `src/diffWorker.test.ts` — engine correctness, line-number offsets after
  peeling, ignore flags in both modes, the size cap.
- `src/components/FolderDiff.test.ts` — status classification, root stripping.
- `src/components/CommandPalette.test.ts` — fuzzy matching and ranking.
- `computeDiffStats` coverage lives in `src/diffWorker.test.ts`.

**Interaction — driven through the real UI:**

- `src/App.interaction.test.tsx` — landing to studio, typing, running a
  comparison, swap/clear/sample, view switching.
- `src/CommandPalette.interaction.test.tsx` — Ctrl+K, filtering, running
  commands, and Escape ordering between stacked overlays.
- `src/persistence.test.tsx` — save/load key parity, restore on mount, and
  survival of a throwing localStorage.
- `src/shareExpiry.test.tsx` — expired links refused, missing links reported,
  pre-expiry links still readable. Firestore is mocked at the module boundary.

### Two substitutions make this possible

**Monaco → textarea** (`src/test/monacoMock.tsx`). Monaco never finishes booting
in jsdom; it renders a "Loading..." placeholder and no editable element, so
there is nothing to type into. The mock honours the same `value`/`onChange`
contract, which tests our integration rather than Monaco itself. Opt in per
file:

```ts
vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));
```

**Worker → synchronous stand-in** (`src/setupTests.ts`). It runs the *real*
`computeLCS`/`compute3Way` and replies with the real message shape. The previous
stub replied `{ type: 'RESULT', payload: [] }` — no `requestId`, so the app
silently discarded it and a diff could never complete under test.

jsdom also lacks `matchMedia`, `ResizeObserver` and `scrollIntoView`; all are
stubbed in `src/setupTests.ts`. The app additionally guards `matchMedia` at the
call site, since older embedded webviews lack it too.

### Known limits

- **`react-virtuoso` renders no rows under jsdom.** It measures element heights
  to decide what to mount, and jsdom reports every height as 0. Assert against
  the summary panel (similarity, add/delete counts) rather than row contents.
- **Similarity is unified via `computeDiffStats`.** Both the worker and `App.tsx`
  use `computeDiffStats` from `lib/diffStats.ts` (`unchanged / max(linesA, linesB)`),
  ensuring displayed statistics never drift from engine calculations.

### Verifying a test can actually fail

A test that passes against broken code is worse than no test. When adding one,
break the thing it guards and confirm it goes red. This caught a real gap: the
line-number test peeled a prefix and suffix that left only *changed* lines in
the middle, so the `prefix + i` offset on unchanged rows was never executed and
deleting it failed nothing. `offsets unchanged lines inside the trimmed middle
section` exists for that path.
