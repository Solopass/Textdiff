/**
 * Escaping and sanitisation of untrusted input.
 *
 * escapeHtml feeds strings that end up in dangerouslySetInnerHTML, and
 * sanitizeCustomCss handles CSS that can arrive from an imported preset file.
 * Both are security-relevant — see SECURITY.md.
 */

export const escapeHtml = (str: string) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Strips the constructs that turn "user styles their own UI" into a data
 * exfiltration or spoofing primitive. Custom CSS can arrive from an imported
 * preset JSON file, not just the local textarea, so it is treated as
 * untrusted input.
 *
 * Note this is defence in depth, not a security boundary — CSS cannot execute
 * script in any current browser, and the real guarantee comes from the CSP in
 * index.html. What this prevents is the practical abuse: remote fetches that
 * leak "this user opened this diff" to a third party, and overlays that cover
 * the real UI with fake controls.
 */
export const sanitizeCustomCss = (css: string) => {
  if (!css) return "";
  return (
    css
      // No remote loads: @import and url() both phone home, which leaks the
      // visit and can be used to fingerprint or track.
      .replace(/@import[^;]*;?/gi, "")
      .replace(/url\s*\(/gi, "blocked-url(")
      // Legacy IE vectors, harmless on modern browsers but free to remove.
      .replace(/expression\s*\(/gi, "blocked-expression(")
      .replace(/javascript\s*:/gi, "blocked:")
      .replace(/behavior\s*:/gi, "blocked-behavior:")
      // </style> would terminate the block early and let the rest of the
      // string be parsed as markup.
      .replace(/<\/?\s*style/gi, "")
      // A full-viewport fixed overlay can hide the real UI behind a fake one.
      .replace(/position\s*:\s*fixed/gi, "position: static")
  );
};
