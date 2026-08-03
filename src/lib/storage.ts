/** localStorage access that cannot throw into a render. */

/**
 * localStorage has a hard ~5MB per-origin quota. Persisting two large pasted
 * files blows straight past it and setItem throws QuotaExceededError, which
 * previously propagated out of a render effect and broke the app on every
 * subsequent keystroke. Persistence is a convenience, not a correctness
 * requirement, so failures are swallowed.
 */
export const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage disabled (private mode / blocked cookies).
    return false;
  }
};
