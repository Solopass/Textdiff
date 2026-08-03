# Contributing

## Setup

Node 22 or newer (jsdom, `@testing-library/jest-dom` and undici all require it;
the version is pinned in `.nvmrc` and used by CI).

```powershell
git clone https://github.com/Solopass/Textdiff.git
cd Textdiff
npm install
npm run dev          # http://localhost:3000
```

`npm run dev` starts the Express server with Vite in middleware mode, so the
Socket.IO and Gemini endpoints are available locally. For just the frontend,
`npm run build:web && npm run preview` is faster.

Copy `.env.example` to `.env` if you need the backend features. Nothing in `.env`
is required for ordinary frontend work.

## Before you open a PR

```powershell
npm run typecheck
npm test
npm run build:web
```

> `&&` chains only in PowerShell 7+. On Windows PowerShell 5.1 use `;` or run
> each line separately — `;` runs the next command regardless of failure, so
> check the output.

CI runs exactly these three and blocks the deploy if any fail, so running them
locally saves a round trip. There is no linter or formatter configured — match
the style of the file you're editing.

### Also do a browser pass

The test suite covers pure logic; UI flows are not covered. After
`npm run build:web` then `npm run preview`, check the browser console for CSP
violations and exercise anything you touched. Changes to `index.html`,
`vite.config.ts`, or anything involving Monaco especially warrant this — a bad
CSP change white-screens the app without failing a single test.

## Things that are easy to break

These are load-bearing and non-obvious. `docs/ARCHITECTURE.md` has the full
reasoning; the short version:

- **Don't add heavy dependencies to the initial bundle.** Use `import()` at the
  call site or `React.lazy`. Adding a library to `manualChunks` does *not* make
  it lazy and can make it eager. Verify with:
  ```powershell
  .\scripts\Check-Bundle.ps1
  ```
- **Adding a persisted setting means three edits**, not one: the `tds_config`
  payload, the loader that reads it back, and the effect's dependency array.
  These have silently drifted before.
- **Line numbers in `computeLCS` are offset by the peeled prefix.** Tests guard
  this, but understand it before editing the backtrack.
- **`firestore.rules` pins the shared-document shape.** Change the share payload
  and you must change the rules, and deploy them (see `SECURITY.md`).
- **Escaping in `highlightCode()` feeds `dangerouslySetInnerHTML`.** Treat it as
  security-relevant.

## Tests

Vitest with jsdom, 72 tests in two layers.

```powershell
npm test           # once
npm run test:watch # watch mode
```

**Unit tests** for pure logic — extract the logic and test it directly. That's
how the diff engine, folder comparison, and palette matching are covered.

**Interaction tests** drive the real UI with `@testing-library/user-event`. To
write one, mock Monaco at the top of the file:

```ts
vi.mock("@monaco-editor/react", async () => await import("./test/monacoMock"));
```

Monaco never boots in jsdom, so the mock swaps it for a textarea honouring the
same `value`/`onChange` contract. `Worker` is replaced globally in
`src/setupTests.ts` with a synchronous stand-in that runs the real diff engine,
so comparison flows are genuinely exercised.

Two gotchas:

- **`react-virtuoso` renders no rows under jsdom** — it measures heights and
  jsdom reports 0 for everything. Assert on the summary panel, not row contents.
- **Both editor layouts are in the DOM** (wide and stacked; CSS hides one).
  `getAllByTestId("monaco-editor")` returns four elements. They share state, so
  driving the first two is enough.

jsdom also lacks `matchMedia`, `ResizeObserver` and `scrollIntoView`; all are
stubbed in `src/setupTests.ts`. If you hit another missing browser API, stub it
there rather than working around it in application code — but if real browsers
might also lack it, guard the call site too.

### Confirm your test can fail

Before considering a test done, break the code it covers and watch it go red. A
test that passes against broken code is worse than no test, and this is not
hypothetical here — a line-number test in this repo passed against a
deliberately reintroduced bug because the case it used never reached the
relevant branch.

## Commits and PRs

No enforced convention. A clear imperative subject line is enough
("Fix line numbers after prefix peeling"). Explain *why* in the body when the
change isn't self-evident.

PRs run the same checks as `main`. Deploy steps are skipped for pull requests.

## Project layout

See `docs/ARCHITECTURE.md`. Briefly: `src/App.tsx` holds most of the UI (known
debt), `src/diffWorker.ts` is the engine, `src/components/` holds the panels, and
`server.ts` is an optional backend that is not deployed to GitHub Pages.

## License

Contributions are accepted under the project's Custom Non-Commercial Open Source
License — see `LICENSE`.
