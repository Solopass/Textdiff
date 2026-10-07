# Security

## Reporting a vulnerability

Open a GitHub issue at
[Solopass/Textdiff](https://github.com/Solopass/Textdiff/issues). If the issue is
sensitive, mark it clearly and avoid posting a working exploit in the initial
report.

This is a personal project, not a commercial product with an SLA. Expect
best-effort response times.

## What this app does with your data

**Diffing is entirely local.** Text you paste, files you drop, and folders or
archives you select are read and compared in your browser. Nothing is uploaded as
part of a normal comparison.

Data leaves the browser only when you explicitly ask:

| Action | Where it goes |
| --- | --- |
| "Share" → encrypted link *(default)* | A Firestore document holding **ciphertext only**; the key travels in the link's `#fragment` |
| "Share" → password | A Firestore document holding ciphertext; the password never leaves the browser |
| "Share" → open link | A Firestore document, readable by anyone with the link |
| "Share" → URL fragment | Nowhere — the data is compressed into the URL itself (open shares only, when Firestore is unreachable) |
| "Post to feed" | A **public, permanent** `diff_feed` document: your caption, handle, stats, and (if ticked) the first hunk |
| Gist sync | GitHub, under your personal access token |
| GitHub repo browsing | Requests to `api.github.com` |
| AI resolution *(backend only)* | Your text is sent to the Gemini API |
| Multiplayer *(backend only)* | Your text is broadcast to everyone in the room |

The last two are disabled in the GitHub Pages build.

## Firestore rules

`firestore.rules` is **not** deployed by the GitHub Actions workflow. Push it
separately:

```powershell
firebase deploy --only firestore:rules
```

**Deploy the app code and the rules together, or the app first.** The rules pin
the exact document shape the client writes (`data`, `timestamp`, `expiresAt`);
deploying rules that don't match the running client will break sharing. The
current rules require `expiresAt`, so an older client that doesn't send it will
be rejected.

What the rules enforce, and why:

- **`get` allowed, `list` denied.** Anyone with a link can open that one
  document, but nobody can enumerate the collection and harvest every diff ever
  shared. Document ids are Firestore auto-ids (20 characters over a ~62-symbol
  alphabet), so they aren't practically guessable.
- **~900KB size cap and a fixed key set on create.** Bounds abuse of an
  unauthenticated write endpoint.
- **An `expiresAt` is required on create**, must be in the future, and may be at
  most ~31 days beyond the timestamp. A client cannot mint a link that outlives
  the retention policy.
- **`update` denied.** A shared link is immutable — nobody can rewrite the
  contents of a URL someone else has already circulated.
- **`delete` denied, except for burn-after-reading shares.** A document created
  with `burnAfterReading: true` may be deleted by anyone holding its id — the id
  is the read capability too. The reader's client deletes it right after a
  successful decrypt. Everything else is deleted only by the cleanup job below,
  using the Admin SDK.

The key set on create is `data`, `timestamp`, `expiresAt`, and optionally
`burnAfterReading` (which must be `true` if present).

### The diff feed

`/diff_feed` is public by design: `get` and `list` are allowed (pages of ≤50),
create is shape- and size-checked (caption ≤280, author ≤30 matching
`@[A-Za-z0-9_.-]+`, hunk ≤2000, ≤5 tags, integer stats), `timestamp` must
equal `request.time`, and update/delete are denied to clients. Posts are
plaintext and permanent — the composer says so before posting.

It is an unauthenticated write endpoint, so spam is the main risk. The
client's 30-second cooldown is a courtesy, not a control. If abuse appears,
add Firebase App Check and moderate with the Admin SDK.

### Share encryption

Encrypted shares (`src/lib/crypto/symmetric.ts`) use AES-256-GCM from the
browser's WebCrypto. `data` then holds `tdsenc1:` followed by a JSON envelope
(IV, ciphertext and, for passwords, the PBKDF2 salt and iteration count) —
never plaintext, and not the note either.

- **Encrypted link:** a random 256-bit key per share, put in the URL fragment
  (`?id=<doc>#key=<base64url>`). Browsers don't send fragments in requests, so
  neither GitHub Pages nor Firebase sees the key. Anyone who has the whole
  link can read the share; anyone with only the database cannot.
- **Password:** PBKDF2-SHA256, 100,000 iterations, random 128-bit salt. The
  link alone opens nothing. The strength is the password's.

GCM authenticates the ciphertext, so tampering or a wrong key fails loudly.
If Firestore is unreachable, an encrypted share fails with an error rather than
falling back to the plaintext URL-fragment link.

What this does **not** protect against: a link pasted somewhere that logs full
URLs including fragments (some chat apps and browser-sync services do), or a
compromised copy of the app itself — the code that does the encrypting is
served by the same origin.

### Pro licences

Pro is unlocked by an Ed25519-signed token (`src/lib/crypto/license.ts`)
verified offline against a public key compiled into the app. The private key
lives outside the repository (default `~/.textdiff/license-signing-key.jwk`,
used by `scripts/issue-license.ts`). **Back it up; if it's lost, no new
licences can be issued without shipping a new public key, and if it leaks,
anyone can mint licences.** Enforcement is client-side and therefore
honour-system: it gates features, not data.

### Expiry and cleanup

Share links expire after 30 days (`SHARE_TTL_DAYS` in `src/lib/constants.ts`).

The rules require an `expiresAt` on create and cap it at ~31 days out, so a
client cannot mint a longer-lived link. The app refuses to render an expired
document. Neither of those deletes anything, so run the cleanup job on a
schedule — daily is ample:

```powershell
npm install firebase-admin       # not a project dependency; server-only
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
node scripts/cleanup-expired-shares.mjs --dry-run   # inspect first
node scripts/cleanup-expired-shares.mjs
```

On macOS or Linux use `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`
instead.

It uses the Admin SDK, which bypasses security rules — that is the only way to
delete, since the rules deny deletes to every client. Keep the service account
key off any machine that doesn't need it.

Documents created before expiry shipped carry no `expiresAt`, are invisible to
the cleanup query, and never expire. Delete them once by hand if that matters.

### Known limitations

Sharing is anonymous and unauthenticated by design, which caps how much the rules
can do:

- **Shared diffs are readable by anyone with the full link** for as long as
  they live (password shares additionally need the password). There is no way
  to revoke a specific link early, short of burn-after-reading. Open
  (unencrypted) shares are also readable by anyone with database access.
- **Writes are unauthenticated.** Rate limiting is not possible in rules alone;
  the size cap is the only brake on someone scripting writes.

Adding accounts would let `get` be gated on an owner check plus an explicit
`public` flag. That's the right fix if this ever holds anything sensitive.

## Content Security Policy

The CSP lives in a `<meta>` tag in `index.html` because GitHub Pages can't set
response headers. See `docs/ARCHITECTURE.md` for why each source is present.

Two deliberate choices:

- **`'unsafe-eval'` is not granted.** No bundled dependency needs it. If you add
  one that does, prefer replacing the dependency over loosening the policy.
- **`frame-ancestors` is omitted**, because it is ignored in a `<meta>` CSP.
  Including it would imply clickjacking protection that isn't actually in effect.
  Real protection requires a host that can set headers.

The app renders syntax-highlighted user text through `dangerouslySetInnerHTML`.
Input is escaped in `highlightCode()`; the CSP is the backstop if that escaping
is ever wrong. Be careful changing either.

## Secrets

- **`firebase-applet-config.json` is committed on purpose.** Firebase web config
  is a public identifier, not a credential — access is controlled by
  `firestore.rules`. This is per Firebase's own guidance.
- **`GEMINI_API_KEY` is a real secret.** It belongs in `.env` (gitignored) and is
  only ever read server-side in `server.ts`. It must never reach the client.
- **GitHub personal access tokens** are stored in `localStorage`, which means any
  XSS on the origin can read them. Scope tokens to `gist` only, and treat this as
  a reason to keep the CSP tight.

## Backend hardening (`server.ts`)

Relevant only if you deploy the Node backend. It is not part of the Pages build.

- Socket.IO CORS is restricted to `ALLOWED_ORIGINS` (defaults to
  `http://localhost:3000`). **Set this before exposing the server** — the
  previous `origin: '*'` let any page on the internet open a socket.
- The Gemini endpoint is rate limited to 10 requests per IP per minute, caps
  input at 100,000 characters, and returns generic errors so upstream SDK
  messages can't leak request URLs or key fragments.
- The rate limiter is in-memory and single-process. Behind multiple instances,
  put a real gateway in front.
- **Multiplayer rooms are unauthenticated.** Room ids are the only secret; anyone
  who guesses or is told one can read everything typed in it.
