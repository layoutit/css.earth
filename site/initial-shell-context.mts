/** Runs in the static document's head, before a query-specific card can paint. */
export function deferInitialShellContext(document: Document, url: string) {
  const query = new URL(url).searchParams;
  if (['overview', 'focus', 'dataset', 'feature', 'v'].some(key => query.has(key))) {
    document.documentElement.dataset.shellContext = 'pending';
  }
}
export const initialShellContextBootstrap = `(${deferInitialShellContext.toString()})(document, location.href);`;
