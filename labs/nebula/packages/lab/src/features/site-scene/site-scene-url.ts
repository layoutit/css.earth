import { EMBED_BRIDGE_PARAMETER, EMBED_HIDDEN_LAYERS_PARAMETER, formatHiddenWorldLayers } from '@cssearth/renderer/embed/embed-bridge.ts';
import type { WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';

/** Ids as the website's object routes and dataset links accept them (site/model/dataset-url.mts). */
export const isAppObjectId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/u.test(id) && id.length <= 128;
export const isAppDatasetId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id) && id.length <= 128;

/** The website's own page for an app object, dataset and saved view, embedded for the lab: `?embed` shows only the scene,
 * `bridge=<lab origin>` lets this lab drive it (and keeps it on its object), `hide=` names the layers it opens with off. */
export function siteSceneUrl(siteOrigin: string, labOrigin: string, app: { object: string; dataset?: string; view?: string }, hidden: readonly WorldLayer[] = []): URL {
  if (!isAppObjectId(app.object)) throw new TypeError(`Invalid app object id: ${JSON.stringify(app.object)}`);
  if (app.dataset !== undefined && !isAppDatasetId(app.dataset)) throw new TypeError(`Invalid app dataset id: ${JSON.stringify(app.dataset)}`);
  const origin = new URL(siteOrigin), lab = new URL(labOrigin);
  for (const value of [origin, lab]) if (value.protocol !== 'http:' && value.protocol !== 'https:') throw new TypeError(`Origins must be http(s): ${value.href}`);
  const url = new URL(`/${app.object}/`, origin.origin);
  if (app.dataset) url.searchParams.set('dataset', app.dataset);
  // A copied view (Copy view's `view=`) opens as the page's own saved view, `v=`.
  if (app.view !== undefined) {
    if (!/^[A-Za-z0-9_-]{3,5462}$/u.test(app.view)) throw new TypeError('Invalid saved view.');
    url.searchParams.set('v', app.view);
  }
  url.searchParams.set('embed', '');
  url.searchParams.set(EMBED_BRIDGE_PARAMETER, lab.origin);
  const hide = formatHiddenWorldLayers(hidden);
  if (hide) url.searchParams.set(EMBED_HIDDEN_LAYERS_PARAMETER, hide);
  return url;
}
