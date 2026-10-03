/** Runs in the static document's head, before a query-specific card can paint. */
export function deferInitialShellContext(document: Document, url: string, sceneRoute: string) {
  const location = new URL(url), query = location.searchParams;
  // ?embed shows only the scene, for the wiki's object viewer; the shell still mounts, hidden.
  if (query.has('embed')) document.documentElement.dataset.embed = '';
  // The page of an object seen from inside draws this scene under its own path.
  const levelPage = location.pathname !== '/' && location.pathname !== sceneRoute;
  if (levelPage || ['dataset', 'feature', 'v'].some(key => query.has(key))) {
    document.documentElement.dataset.shellContext = 'pending';
  }
}
/** The head script for the page of scene `sceneId`. */
export const initialShellContextBootstrap = (sceneId: string) =>
  `(${deferInitialShellContext.toString()})(document, location.href, ${JSON.stringify(`/${sceneId}/`)});`;
