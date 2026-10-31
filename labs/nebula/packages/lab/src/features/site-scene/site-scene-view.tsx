import { useEffect, useMemo, useRef } from 'react';
import type { WorldLayer } from '@cssearth/renderer/universe/world-layers.ts';
import { connectSiteBridge, type SiteBridge } from './site-bridge.ts';
import { siteSceneUrl } from './site-scene-url.ts';

declare const __CSSEARTH_SITE_ORIGIN__: string;

/** The website's own page for the subject's app object: no lab drawing code. The page is served by the site, so the world,
 * catalogues, background, dataset banks and camera are exactly the app's; the lab drives it through the bridge and draws
 * only its own layers over it (`#viewer`). The frame is made once per object: datasets and layers change by command. */
export function SiteSceneView({ object, dataset, view, hidden, name, onBridge }: { object: string; dataset?: string; view?: string; hidden: readonly WorldLayer[]; name: string;
  onBridge(bridge: SiteBridge | null): void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  // The link the frame opens on; later dataset and layer changes are commands, so they do not reload the page.
  const src = useMemo(() => siteSceneUrl(__CSSEARTH_SITE_ORIGIN__, location.origin, { object, ...(dataset ? { dataset } : {}), ...(view ? { view } : {}) }, hidden).href,
    // Only the object reloads the frame: `dataset`, `view` and `hidden` reach it later as commands.
    [object]);
  useEffect(() => {
    const bridge = connectSiteBridge({ windowTarget: window, frame: () => frame.current?.contentWindow ?? null, siteOrigin: new URL(__CSSEARTH_SITE_ORIGIN__).origin });
    onBridge(bridge);
    return () => { onBridge(null); bridge.destroy(); };
  }, [object, onBridge]);
  return <iframe ref={frame} className="site-scene-view" data-site-object={object} src={src} title={`${name} as the website shows it`} />;
}
