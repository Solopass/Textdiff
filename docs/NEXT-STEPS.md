# Next steps

A working checklist, ordered. Each task says how to know it actually worked —
that matters more than the steps themselves.

Baseline as of writing: 72 tests passing, typecheck clean, production build
green, initial load ~132KB gzipped.

---

## 0. Ship what's already built

Nothing below matters until this is out. The work is committed on the
`overhaul/v1` branch and not yet pushed.

All commands below are PowerShell, run from the repository root.

### 0.1 — Smoke test in a real browser

`npm run verify` already boots the production bundle and confirms React mounts,
the toolbar renders, the command palette works, and a diff renders — all green.

What it cannot do is enforce a Content Security Policy or run Monaco, because
jsdom does neither. A bad CSP white-screens the app while every automated check
still passes. **That is the only reason this step exists**, so the console is
what matters most below.

```powershell
npm ci
npm run verify      # typecheck + tests + build + smoke test of the built bundle
npm run preview
```

> In PowerShell, `&&` only chains commands in PowerShell 7+. On Windows
> PowerShell 5.1 it is a parse error, so the commands are listed separately.
> Check with `$PSVersionTable.PSVersion`.

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

```powershell
firebase deploy --only firestore:rules
```

Verify: create a share link from the deployed site and open it in a private
window. If you get `PERMISSION_DENIED`, the rules and the client are out of
sync — check that the deployed app is the new one.

### 0.3 — Push

The work is already committed on the `overhaul/v1` branch; `main` is untouched.

```powershell
git status                       # expect a clean tree on overhaul/v1
git push -u origin overhaul/v1
```

Then open a pull request. CI runs typecheck → tests → build on PRs and skips
the deploy steps, so you get a green check before anything reaches the live
site. Merge to `main` when it passes.

### 0.4 — Note the similarity change in your release notes

Similarity now reads **67%** where it used to read 50% for three lines with one
edit. It's a fix — a modified line was being counted as both a deletion and an
addition — but to anyone who has used the tool before it will look like a bug.
One sentence is enough.

### 0.5 — Schedule the share cleanup

Expiry is enforced in three places, but nothing *deletes* until this runs.

```powershell
npm install firebase-admin       # server-only; deliberately not a project dep
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
node scripts/cleanup-expired-shares.mjs --dry-run
```

`$env:` sets the variable for the current session only. To persist it for your
user account:

```powershell
[Environment]::SetEnvironmentVariable(
  "GOOGLE_APPLICATION_CREDENTIALS", "C:\path\to\service-account.json", "User")
```

Once the dry run looks right, drop `--dry-run` and schedule it daily (GitHub
Actions on a cron, Cloud Scheduler, or a plain crontab). Daily is ample for a
30-day TTL.

Note: documents created before expiry shipped have no `expiresAt`, are invisible
to the cleanup query, and never expire. Delete them once by hand if you care.

---

## 1. Self-host Monaco [COMPLETED]

**Completed:** Monaco Editor 0.56.0 is explicitly installed and bundled locally with its
5 web workers (`editor`, `json`, `css`, `html`, `ts`). Configured dynamic import chunking
so Monaco is only fetched when the editor initializes, maintaining first-paint bundle size
at ~135 KB gzipped. `jsdelivr` was removed from `script-src`, `style-src`, `font-src`,
and `connect-src` in `index.html`.

---

### Steps

1. Add Monaco explicitly. It's currently in `node_modules` only as an
   auto-installed peer (0.56.0), while the CDN serves a *different* version
   (0.55.1). Pinning it removes that mismatch.

   ```powershell
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

```powershell
npm run build:web
.\scripts\Check-Bundle.ps1 -CheckCdn
```

`-CheckCdn` reports any built asset still referencing jsdelivr or cdnjs. You
want none.

Then load the preview with devtools **Network** open and filter for
`jsdelivr` — there must be zero requests. Also check the initial payload didn't
balloon:

```powershell
.\scripts\Check-Bundle.ps1
```

It lists what loads on first paint with raw and gzipped sizes, totals them, and
fails if any of firebase / jspdf / html2canvas / socket.io has stopped being
lazy.

If that number jumped a lot, Monaco ended up in the entry chunk — it needs to
stay behind the lazy boundary. See the code-splitting section in
`ARCHITECTURE.md`; naming a chunk does not make it lazy.

Update `ARCHITECTURE.md` (the CSP section says jsdelivr is required *because of*
Monaco) and `SECURITY.md` when this lands.

---

## 2. Accessibility checks in CI [COMPLETED]

**Completed:** Installed `vitest-axe` and established automated WCAG testing in `src/accessibility.test.tsx` for all major dialogs and toolbars (Shortcuts, History, Git Conflict, Cloud Sync, Customize, Command Palette, Stats Banner).
Implemented `useFocusTrap` (`src/hooks/useFocusTrap.ts` + unit tests) ensuring:
- Focus trapping within modal dialogs (Tab / Shift+Tab looping).
- Closing via the `Escape` key.
- Initial focus acquisition on the first interactive element or dialog container.
- Focus restoration to the invoking element on close / unmount.
- Standard WCAG attributes: `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` across modals.

---

## 3. Wire up `CloudSyncModal` [COMPLETED]

`src/components/CloudSyncModal.tsx` is now wired to state in `App.tsx`, with a
dedicated toolbar button ("GIST"), command palette entry ("Sync with GitHub Gist"),
Escape key listener integration, and an `onDiff` callback to automatically compare
imported gists. Tested and verified in the test suite.

---

## 4. Continue splitting `App.tsx` [COMPLETED]

Reduced `App.tsx` by over 1,000 lines (down from 3,755 lines to 2,748 lines):
1. **History modal** (`src/components/HistoryModal.tsx`) — extracted with full restore flow and focus trap.
2. **Git conflict resolver modal** (`src/components/GitConflictModal.tsx`) — extracted with parser logic and AI resolve callbacks.
3. **Customize modal** (`src/components/CustomizeModal.tsx`) — extracted with theme/typography controls and accessible toggle labels.
4. **Stats banner** (`src/components/StatsBanner.tsx`) — extracted pure summary bar.
5. **Studio toolbar** (`src/components/StudioToolbar.tsx`) — extracted top controls with clean callback interfaces.

---

## 5. Advanced Features: Inline Editing, Moved Block Detection & Adjustable Fold Context [COMPLETED]

**Completed:**
1. **Adjustable Fold Context:**
   - Replaced hardcoded 3-line fold context with selectable options (1, 3, 5, 10 lines).
   - Added persistence in `tds_config` (`localStorage`) across mounts, with full coverage in `persistence.test.tsx`.
   - Exposed quick selectors in `StudioToolbar` and dedicated options in the Command Palette (`Ctrl+K`).
2. **Moved Block Detection:**
   - Built greedy block relocation detection in `src/diffWorker.ts` (`detectMovedBlocks`), correlating deleted blocks with added blocks across the diff.
   - Annotates rows with `moved: 'from' | 'to'` and `movedBlockId`, styled with distinctive accent badges (`MOVED #ID ↷` / `MOVED #ID ↶`).
   - Covered with comprehensive unit tests in `src/diffWorker.test.ts`.
3. **Inline Diff Editing:**
   - Double-clicking any diff row in Split or Unified view opens an inline editor directly in the diff table.
   - Provides keyboard shortcuts (`Enter` to save, `Escape` to cancel) and direct action buttons (`✓`, `✕`).
   - Commits edits to `origText` / `modText` and triggers live re-diffing through the worker.
   - Tested and verified end-to-end in `src/inlineDiffEdit.test.tsx`.

---

## 6. Tiered Client-Side Encryption (The Only Paid Feature) [PARTLY DONE]

**Done:**
- Free tier: `src/lib/crypto/symmetric.ts`. Encrypted link (random key in
  `?id=<doc>#key=…`, the default), password (PBKDF2 100k → AES-256-GCM), or
  open. `ShareModal` replaces the old `prompt()`; `UnlockShareModal` asks for
  passwords. The design's `#share=<docId>&key=` became `?id=<doc>#key=` so old
  links and the existing read path keep working.
- Licensing: `src/lib/crypto/license.ts`, `ProActivationModal`, header
  "GO PRO" / "PRO ENCRYPTION" badge, palette entry. Mint keys with
  `bun scripts/issue-license.ts --name "…" --email … [--days N]`. The private key
  is at `~/.textdiff/license-signing-key.jwk` — **back it up somewhere safe**.
  Stores the raw token rather than decoded fields, so it is re-verified each load.
- Burn after reading (Pro), with a matching `firestore.rules` change.
- Fixed in passing: self-hosted Monaco never actually loaded (see the CSP
  section of `ARCHITECTURE.md`). Editors were stuck on "Loading..." in the
  production build.

**Before deploying:** deploy `firestore.rules` *before* anyone uses burn after
reading — the old rules reject the extra key. The new rules accept everything
the old ones did, so rules-first is safe here.

**Still to do (marked "(soon)" in the Pro dialog — keep those honest):**
- Recipient public-key encryption (ECDH P-256 / RSA-OAEP, GitHub `.keys`).
  Note GitHub keys are SSH keys: `ssh-rsa` converts to RSA-OAEP, but
  `ssh-ed25519` can't encrypt directly. Recipients also need a keypair UI.
- WebAuthn PRF hardware binding.
- `.tds.enc` archives. AES-GCM already authenticates, so the planned
  HMAC-SHA256 would be redundant — use a GCM envelope like shares.
- A real purchase flow; "Get a licence" is currently a mailto.

### Background & Monetization Philosophy
TextDiff Studio is client-first, private-by-design, and open source (PolyForm Noncommercial).
**This encryption upgrade will be the *only* paid feature this application will ever have.**
All core diff engines, Monaco integrations, local history, export tools (PDF, PNG, patch, CSV),
conflict resolvers, folder comparisons, and basic sharing remain 100% free forever.

Because TextDiff Studio runs entirely as a static client on GitHub Pages, the paid upgrade
**does not require an account server or telemetry**. It uses cryptographically signed offline
license keys (Ed25519) verified locally via WebCrypto, preserving full offline capability.

### 6.1 — Tier Comparison

| Capability | Free Tier ("Mid Encryption") | Paid Pro Tier ("Military / Cool Encryption") |
| :--- | :--- | :--- |
| **Cryptography Core** | Passphrase-derived AES-256-GCM via PBKDF2 (100k rounds) | Asymmetric ECDH (P-256 / P-384) + RSA-OAEP + AES-256-GCM |
| **Key Exchange** | Manual shared password out-of-band | Public-key sharing (encrypt for recipient's public key or GitHub handle) |
| **Zero-Knowledge Link** | Key in URL hash fragment (`#key=...`) | Ephemeral forward secrecy + ECDH envelope |
| **Burn-After-Reading** | Standard 30-day Firestore TTL | One-time self-destructing shares (deleted on first decryption) |
| **Hardware Key Binding** | ✕ None | WebAuthn / FIDO2 passkey hardware envelope (YubiKey / Touch ID) |
| **Offline Archiving** | Plain text / JSON exports | `.tds.enc` encrypted bundle with HMAC-SHA256 integrity verification |
| **Activation Model** | Unlocked out of the box (zero friction) | Offline cryptographically signed license key (Ed25519) |

### 6.2 — Architecture & Implementation

1. **Free Tier Implementation ("Mid Encryption")**:
   - Location: `src/lib/crypto/symmetric.ts`
   - Uses native `window.crypto.subtle` (zero npm bundle bloat).
   - Generates random 128-bit salt and 96-bit IV per encryption.
   - Derives AES-GCM 256-bit key from user passphrase using PBKDF2 (SHA-256, 100,000 iterations).
   - Zero-Knowledge Cloud Sharing: The derived key or passphrase is stored in the browser URL hash fragment (`#share=<docId>&key=<b64>`). Browsers never transmit hash fragments to HTTP servers or Firebase backends. Decryption occurs purely in the client.

2. **Paid Pro Upgrade ("Military / Cool Encryption")**:
   - Location: `src/lib/crypto/asymmetric.ts`, `src/lib/crypto/license.ts`
   - **Offline License Verification**:
     - Embedded public Ed25519 verification key (`TEXTDIFF_RELEASE_KEY`).
     - User pastes license key string: `TDS-PRO-<base64-payload>.<base64-signature>`.
     - Client validates signature using WebCrypto. If valid, stores `{ licensee, email, issuedAt, expiresAt }` in `localStorage` under `tds_pro_license`.
     - Unlocks the "PRO ENCRYPTION" badge in header and enables advanced cipher suites.
   - **Public-Key Recipient Encryption**:
     - Enables User A to encrypt a diff specifically for User B without sharing a password.
     - Supports importing recipient's public key (PEM / JWK / or fetching `https://github.com/<username>.keys`).
     - Generates ephemeral symmetric AES-256-GCM key, encrypts payload, and wraps symmetric key with recipient's RSA-OAEP or ECDH public key.
   - **Burn-After-Reading (Self-Destruct)**:
     - Share document marked with `burnAfterReading: true`.
     - Firestore security rules allow the first reader to trigger deletion upon retrieval, or client requests atomic delete via Firestore transaction.
   - **Hardware Token / Passkey Envelope (WebAuthn)**:
     - Leverages WebAuthn PRF (Pseudo-Random Function) extension or asymmetric credential assertion to bind local diff archives to hardware keys (YubiKey, Apple Touch ID, Windows Hello).

### 6.3 — How you know it worked
- Free tier encrypts a sample diff with password, produces ciphertext without leaking plaintext in network payload, and decrypts accurately when opened with `#key=...`.
- Attempting to unlock Pro features without a license prompts the retro activation modal.
- Entering a valid Ed25519-signed test license key successfully unlocks Pro status, sets `tds_pro_license`, and passes signature verification.
- Tampered license key payloads or invalid signatures are rejected with explicit feedback.
- Public-key encryption roundtrip: generate keypair, encrypt diff with recipient public key, verify decryption succeeds with recipient private key and fails with wrong key.

---

## 7. Public "Diff Feed" (Retro Twitter Micro-Stream) [DONE — needs rules deploy]

**Done:** `POST TO FEED` / `FEED` toolbar buttons and palette entries,
`FeedComposerModal` (280-char counter, persisted handle, stats pills, hunk
preview, optional full-comparison attachment, 30s per-session cooldown, public
warning), `FeedDrawer` (chronological, OPEN IN STUDIO, COPY PATCH, SHARE LINK →
`?post=<id>`), `/diff_feed` rules. Logic in `src/lib/feed.ts`, Firestore calls
in `src/lib/feedApi.ts`; all lazy.

**Deviations from the design below:**
- A post stores the first hunk as unified-diff text (`hunk`, ≤2000 chars)
  instead of `origSnippet`/`modSnippet`. COPY PATCH then needs no re-diffing and
  is a real patch — `src/lib/feed.test.ts` runs `git apply --check` *and*
  `git apply` on it. Both sides for OPEN IN STUDIO come from `splitHunk`.
- `timestamp` is a Firestore server timestamp, and the rules require
  `timestamp == request.time`, so posts can't be backdated or future-dated to
  stay on top. Optional `fileName` added.

**Before it works live:** `firebase deploy --only firestore:rules`. Until then
reads fail with "The feed isn't available right now."

**Open risk — spam.** It's an unauthenticated public write endpoint. The rules
bound size and shape; the 30s cooldown is client-side only and trivially
bypassed. If it gets abused, the next steps are Firebase App Check and an
Admin-SDK moderation script (client deletes are denied by design).

### Background & Vibe
A nostalgic, distraction-free community micro-stream inspired by original 2006–2008 Twitter ("Twttr").
Developers and writers can share what they are working on, patch snippets, refactors, and micro-diffs
directly from the main studio toolbar into a public, chronological firehose. No algorithms, no ads,
no engagement gaming — just pure text changes from across the web.

### 7.1 — Features & UX Workflow

1. **Toolbar Composer ("POST TO FEED")**:
   - Dedicated button on `StudioToolbar` (or `Ctrl+K` -> "Post diff to public feed").
   - Modal micro-composer:
     - **Caption input**: 280 character maximum with live counter.
     - **Author Handle**: Optional handle (e.g. `@jake`, `@anon`), persisted in `tds_author_handle`.
     - **Diff Summary pill**: Auto-attached (`+12 -4`, language, similarity %, file names).
     - **Hunk Preview**: Select whether to include the top 3–5 changed lines as a monospace snippet preview.
     - **Action**: "POST DIFF (280 chars max)" button with retro press animation.

2. **Retro Feed Viewer ("THE FEED")**:
   - Access via toolbar tab or header link: switches view or slides in a clean retro drawer.
   - Minimalist 2006-era Twitter typography & styling: clean borders, high-contrast monospace snippets, retro timestamps ("3m ago", "Oct 7, 2026").
   - Feed Item Anatomy:
     - Header: `@handle` • timestamp • language tag (`#typescript`, `#rust`).
     - Caption: 280-char note explaining the change with highlighted `#hashtags`.
     - Diff Card: Mini syntax-highlighted diff hunk preview showing additions/deletions.
     - Direct Actions:
       - **"OPEN IN STUDIO"**: 1-click loads both buffers directly into TextDiff Studio for interactive comparison, editing, and merging.
       - **"COPY PATCH"**: 1-click copies the unified git diff to clipboard.
       - **"SHARE LINK"**: Quick copy permalink to feed post.

3. **Data Schema & Backend (Firestore `/diff_feed`)**:
   ```typescript
   interface FeedItem {
     id: string;
     author: string;          // max 30 chars, defaults to "@anonymous"
     caption: string;         // max 280 chars
     tags: string[];          // extracted #hashtags
     timestamp: number;       // server timestamp (milliseconds)
     origSnippet: string;     // truncated first hunk (max 1000 chars)
     modSnippet: string;      // truncated first hunk (max 1000 chars)
     fullShareId?: string;    // optional pointer to full diff in /shares collection
     stats: {
       additions: number;
       deletions: number;
       similarity: number;
       language: string;
     };
   }
   ```

4. **Security & Rate Limiting**:
   - Firestore security rules strictly validate:
     - `caption.size() <= 280`
     - `author.size() <= 30`
     - Document size < 4 KB
     - `timestamp` is valid request time
     - Only allows `create` and `read`; `update` and `delete` disallowed for public callers.
   - Client-side cooldown (e.g. 30-second delay between posts per browser session) to prevent accidental flooding.

### 7.2 — How you know it worked
- Clicking "POST TO FEED" from the toolbar opens the micro-composer pre-populated with current diff stats.
- Exceeding 280 characters disables the submit button and turns the character counter red.
- Submitting successfully creates a document in Firestore `/diff_feed` and immediately appears at the top of the feed stream.
- Clicking "OPEN IN STUDIO" on any feed item populates original and modified panes in the studio, runs the diff worker, and updates stats.
- Clicking "COPY PATCH" copies a valid unified diff that can be tested with `git apply --check`.

---

## Optional: remove the manual browser step entirely

Every remaining "you have to check this by hand" item exists because the
automation has no real browser, no CDN access, and no Firebase emulator.
`docs/dev-sandbox-prompt.md` is a ready-to-paste prompt for building a
Docker + WSL sandbox that closes those gaps, with acceptance tests tied to the
exact failures encountered.

Worth doing if the browser pass starts feeling like a tax. Not required to
ship.

---

## Standing rules

Learned the hard way during this work:

- **Break your test and watch it fail** before trusting it. A line-number test
  here passed against a deliberately reintroduced bug because its input never
  reached the relevant branch.
- **Run `.\scripts\Check-Bundle.ps1`** after any dependency or config change. A
  chunk being *named* separately doesn't mean it loads lazily — an earlier
  config shipped 580KB of export libraries to every visitor while looking
  correctly split in the build output.
- **The browser pass isn't optional** for changes to `index.html`,
  `vite.config.ts`, or anything touching Monaco. Tests can't see a CSP.
- **Adding a persisted setting is three edits**: the `tds_config` payload, the
  loader that reads it back, and the effect's dependency array. These drifted
  once and silently reset six settings on every reload.
