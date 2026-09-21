/** A catalogue focus and an overview are two names for the same shared camera,
 * so a URL may carry only one of them. This module owns both: every writer goes
 * through it, and it decides what an incoming URL that names both actually
 * means. The focus wins, because every other resolver already prefers it: the
 * shell reports `prepared-focus` selection while one exists, the router's
 * zoom-out overview watcher stands down while one exists, and the source credit
 * names the focus over the overview. */
const PREPARED_FOCUS_KEYS = ['focus', 'focusLens'] as const;

/** The catalogue focus a URL names. A focus whose prepared bank is still loading
 * has not reached the runtime yet, so the runtime cannot answer this: the URL is
 * the selection, and it is a selection from the moment it is named. */
export function preparedFocusFromUrl(url: string | URL) {
  return new URL(url).searchParams.get('focus');
}

/** Overview routes share the mounted world and its camera. */
export function overviewScopeFromUrl(url: string | URL) {
  const query = new URL(url).searchParams;
  // Normalized once, here: a named focus leaves no overview to resolve.
  if (query.has('focus')) return null;
  const scope = query.get('overview');
  return scope === 'system' || scope === 'milky-way' || scope === 'local-group' || scope === 'nearby-universe' ? scope : null;
}

/** Selects the named catalogue focus, replacing any overview it supersedes. */
export function withPreparedFocus(url: URL, id: string | null, lens: string | null): URL {
  if (id) url.searchParams.set('focus', id); else url.searchParams.delete('focus');
  if (lens) url.searchParams.set('focusLens', lens); else url.searchParams.delete('focusLens');
  if (id) url.searchParams.delete('overview');
  return url;
}

/** Selects the named overview, replacing any catalogue focus it supersedes. */
export function withOverviewScope(url: URL, scope: string | null): URL {
  if (!scope) {
    url.searchParams.delete('overview');
    return url;
  }
  url.searchParams.set('overview', scope);
  for (const key of PREPARED_FOCUS_KEYS) url.searchParams.delete(key);
  return url;
}
