/** Build- and deployment-level flags. */

// Features that depend on the Node/Socket.IO/Gemini backend (server.ts).
// GitHub Pages only serves static files, so these stay disabled until that
// backend is deployed somewhere separately. Flip via .env: VITE_ENABLE_SERVER_FEATURES=true
export const SERVER_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_SERVER_FEATURES === "true";
export const COMING_SOON_TITLE = "Coming soon — needs a live server, not available on GitHub Pages yet";

/**
 * How long a permanent share link stays readable.
 *
 * "Permanent" previously meant forever: there was no expiry and no delete, so
 * anything shared once was public indefinitely. Thirty days covers the actual
 * use case (send someone a diff, they look at it) without accumulating an
 * unbounded public archive of whatever people happened to paste.
 *
 * Changing this only affects newly created links.
 */
export const SHARE_TTL_DAYS = 30;
export const SHARE_TTL_MS = SHARE_TTL_DAYS * 24 * 60 * 60 * 1000;
