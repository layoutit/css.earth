import { isFiniteNumber as coreIsFiniteNumber } from '@cssearth/core';
import { createCameraViewport } from '@cssearth/renderer/navigation/camera/camera-viewport.ts';
import { selectPreparedResponsiveZoom, type ResponsiveZoomPlan } from '@cssearth/renderer/navigation/camera/camera-layout.ts';
import { billboardBodyRadiusPixels } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';

/** What the page bakes for its cover (`ObjectLayout.astro`): the body's camera plan, the mobile layout query and the
 * arrival photograph's optics, so the photograph takes its place as soon as it decodes, before the scene's code and
 * data arrive. */
export interface StartupCover {
  readonly plan: ResponsiveZoomPlan;
  readonly mobileQuery: string;
  readonly billboard: { readonly size: number; readonly focalPixels: number; readonly distanceM: number };
  readonly bodyRadiusM: number;
}

const finite = coreIsFiniteNumber;

/** Validates the baked cover; anything else leaves the photograph to the scene's own startup (startup-billboard.mts). */
export function parseStartupCover(value: unknown): StartupCover | null {
  if (!value || typeof value !== 'object') return null;
  const { plan, mobileQuery, billboard, bodyRadiusM } = value as Record<string, unknown>;
  const asset = billboard as Record<string, unknown> | undefined, camera = plan as Record<string, unknown> | undefined;
  if (typeof mobileQuery !== 'string' || !finite(bodyRadiusM) || bodyRadiusM <= 0 || !asset || !camera ||
      !finite(asset.size) || !finite(asset.focalPixels) || !finite(asset.distanceM) || asset.distanceM <= bodyRadiusM ||
      !finite(camera.logicalBodyDiameter) || !finite(camera.defaultZoom) || !camera.responsiveFit ||
      typeof (camera.projection as Record<string, unknown> | undefined)?.cssPerspective !== 'string') return null;
  return value as StartupCover;
}

/** The arrival photograph's place on this viewport: the same responsive fit and open-area centre the scene's
 * `initialView` gives the body (prepared-object-navigation.ts), and the same scale `prepareArrivalBillboard` publishes. */
export function startupCoverPlacement(cover: StartupCover, viewport: ReturnType<typeof createCameraViewport>, mobile: boolean) {
  const { plan } = cover;
  const snapshot = viewport.read(plan.projection!.cssPerspective);
  const fit = selectPreparedResponsiveZoom({ plan, viewport, mobile });
  const radiusPixels = fit.zoom / plan.defaultZoom * plan.logicalBodyDiameter / 2;
  const { height, top } = snapshot.bounds, open = snapshot.openArea;
  const offsetY = open ? (open.top + open.bottom) / 2 - (top + height / 2) : 0;
  return { offsetY, scale: radiusPixels / billboardBodyRadiusPixels(cover.billboard, cover.bodyRadiusM), radiusPixels };
}

/** Shows the server-rendered arrival photograph in place on a cold default view. The scene's startup adopts the same
 * image and republishes it from its camera (startup-billboard.mts). */
export async function presentStartupCover(document: Document): Promise<void> {
  const window = document.defaultView;
  const image = document.querySelector<HTMLImageElement>('img[data-startup-billboard]');
  const data = document.querySelector<HTMLScriptElement>('script[data-startup-cover]');
  const stage = document.querySelector<HTMLElement>('.object-stage');
  if (!window || !image || !data || !stage || window.location.search) return;
  const cover = parseStartupCover(JSON.parse(data.textContent ?? 'null'));
  // A stage the layout has not sized yet has no camera to fit: the scene's startup places the photograph instead.
  const box = stage.getBoundingClientRect();
  if (!cover || !(box.width > 0 && box.height > 0)) return;
  const mobile = window.matchMedia(cover.mobileQuery).matches;
  // The shell's viewport (world-viewport.mts), read once and released: the scene creates its own.
  const viewport = createCameraViewport(stage, document.querySelector<HTMLElement>('.object-sidebar'), mobile ? {
    above: null, below: document.querySelector<HTMLElement>('.object-viewport-search-band') } : null,
  { header: document.querySelector<HTMLElement>('.explorer-shell-header') });
  let placement: ReturnType<typeof startupCoverPlacement>;
  try { placement = startupCoverPlacement(cover, viewport, mobile); } finally { viewport.destroy(); }
  await image.decode().catch(() => undefined);
  if (!image.isConnected || image.dataset.arrivalBillboard || !image.complete || !image.naturalWidth) return;
  const { offsetY, scale, radiusPixels } = placement;
  Object.assign(image.style, { position: 'absolute', left: '50%', top: '50%', width: `${cover.billboard.size}px`,
    height: `${cover.billboard.size}px`, maxWidth: 'none', margin: '0', transformOrigin: '50% 50%', pointerEvents: 'none',
    zIndex: '2147483646', transform: `translate(-50%, -50%) translate(0px, ${offsetY}px) scale(${scale})`,
    opacity: String(Math.min(1, Math.max(0, (2 * radiusPixels - 2) / 12))) });
  image.dataset.startupCover = 'shown';
  window.performance.mark('cssearth:startup-billboard');
  // The photograph replaces the ring. It looks like the scene but does not answer input yet, so the header's progress line
  // runs. The shell is not mounted this early; once it is, it keeps the line until the detail presents
  // (`setDestinationLoading`, scene-publication.mts).
  document.querySelector('.startup-loading')?.remove();
  document.querySelector('.explorer-navigation-progress')?.setAttribute('aria-hidden', 'false');
}

if (typeof document !== 'undefined') void presentStartupCover(document).catch(error => console.error('Startup cover failed', error));
