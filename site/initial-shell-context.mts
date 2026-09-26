/** Runs in the static document's head, before a query-specific card can paint. */
export function deferInitialShellContext(document: Document, url: string) {
  const query = new URL(url).searchParams;
  // ?embed shows only the scene, for the wiki's object viewer; the shell still mounts, hidden.
  if (query.has('embed')) document.documentElement.dataset.embed = '';
  if (['overview', 'view', 'focus', 'dataset', 'feature', 'v'].some(key => query.has(key))) {
    document.documentElement.dataset.shellContext = 'pending';
  }
}
export const initialShellContextBootstrap = `(${deferInitialShellContext.toString()})(document, location.href);`;
