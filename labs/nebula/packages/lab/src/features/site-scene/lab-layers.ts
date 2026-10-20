import { EMBED_HIDDEN_LAYERS_PARAMETER, formatHiddenWorldLayers, readHiddenWorldLayers } from '@cssearth/renderer/embed/embed-bridge.ts';
import type { WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';

/** The lab opens the website's scene without its labels until the link says otherwise. */
export const DEFAULT_HIDDEN_LAYERS: readonly WorldLayer[] = ['labels'];

/** The layers the lab's link hides (`hide=`, the page's own parameter); its default when the link names none. */
export function readLabLayers(url: URL): WorldLayer[] {
  if (!url.searchParams.has(EMBED_HIDDEN_LAYERS_PARAMETER)) return [...DEFAULT_HIDDEN_LAYERS];
  try { return readHiddenWorldLayers(url.searchParams.get(EMBED_HIDDEN_LAYERS_PARAMETER)); } catch { return [...DEFAULT_HIDDEN_LAYERS]; }
}
/** The link with these layers hidden; an empty list is written too, so a reload shows every layer. */
export function withLabLayers(url: URL, hidden: readonly WorldLayer[]): URL {
  const next = new URL(url);
  next.searchParams.set(EMBED_HIDDEN_LAYERS_PARAMETER, formatHiddenWorldLayers(hidden));
  return next;
}
export function writeLabLayers(hidden: readonly WorldLayer[]) {
  const url = withLabLayers(new URL(location.href), hidden);
  if (url.href !== location.href) history.replaceState(history.state, '', url);
}
