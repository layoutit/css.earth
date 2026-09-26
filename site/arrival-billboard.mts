import { presentWorldCamera, worldCameraFromCenteredPresentation } from '@cssearth/renderer/navigation';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import { opacityClockFor } from '@cssearth/renderer/stars/opacity-clock.ts';
import type { PreparedArrivalView } from './arrival-view.mts';
import type { VisibleRect } from '@cssearth/renderer/solar-system/types.ts';

type BillboardViewport = WorldCameraViewport & { readonly visibleRect: VisibleRect | null };

/** Stop at the prepared perspective before continuing to the responsive close-up.
 * Overview targets outside that distance never detour inward just for an image. */
export function arrivalBillboardHandoff(arrival: PreparedArrivalView | undefined, target: WorldCameraPose,
  frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport, lens?: string | null): WorldCameraPose | null {
  if (!arrival?.billboard || (lens ?? arrival.defaultLens) !== arrival.defaultLens) return null;
  const projection = presentWorldCamera(target, frame, viewport);
  if (projection.distanceM > arrival.billboard.distanceM * (1 + 1e-5) ||
      projection.rotation.some((value, index) => Math.abs(value - arrival.rotation[index]!) >= 1e-8) ||
      // Subtracting remote world positions can leave a tiny centring residue.
      // Judge it in visible pixels, rather than body-dependent scene units.
      !projection.centerPixels || Math.hypot(...projection.centerPixels) > 0.5) return null;
  return worldCameraFromCenteredPresentation({ rotation: arrival.rotation,
    distanceUnits: arrival.billboard.distanceM / frame.metersPerUnit }, frame, viewport);
}

/** A retained image survives the detailed scene replacement. Its projection follows
 * the same acknowledged world camera; only transform and opacity change in flight. */
export async function prepareArrivalBillboard(stage: HTMLElement, arrival: PreparedArrivalView,
  frame: PreparedWorldCameraFrame, signal: AbortSignal) {
  const asset = arrival.billboard;
  if (!asset) throw new Error('Arrival billboard is not prepared.');
  const document = stage.ownerDocument, window = document.defaultView;
  if (!window) throw new Error('Arrival billboard requires a window.');
  const image = document.createElement('img'), clock = opacityClockFor(window);
  image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.draggable = false;
  image.dataset.arrivalBillboard = 'flight';
  Object.assign(image.style, { position: 'absolute', left: '50%', top: '50%', width: `${asset.size}px`,
    height: `${asset.size}px`, maxWidth: 'none', margin: '0', transformOrigin: '50% 50%',
    pointerEvents: 'none', zIndex: '2147483646', opacity: '0' });
  let frameId: number | null = null, disposed = false, rejectPending: ((reason: unknown) => void) | null = null;
  const aborted = () => signal.reason ?? new DOMException('Arrival cancelled.', 'AbortError');
  function destroy() {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', cancel);
    if (frameId !== null) clock.cancel(frameId);
    image.remove(); image.removeAttribute('src');
    rejectPending?.(aborted()); rejectPending = null;
  }
  function cancel() { destroy(); }
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) { destroy(); throw aborted(); }
  image.src = asset.url;
  try {
    await new Promise<void>((resolve, reject) => {
      rejectPending = reject;
      image.decode().then(() => { rejectPending = null; resolve(); }, reject);
    });
    if (disposed) throw aborted();
    (stage.parentElement ?? stage).appendChild(image);
  } catch (error) { destroy(); throw error; }
  return {
    publish(world: WorldCameraPose, viewport: BillboardViewport) {
      if (disposed) return;
      const projection = presentWorldCamera(world, frame, viewport), center = projection.centerPixels;
      const depthM = projection.depthUnits * frame.metersPerUnit;
      if (!center || !projection.silhouette || depthM <= 0) { image.style.opacity = '0'; return; }
      const scale = viewport.focalPixels / asset.focalPixels * asset.distanceM / depthM;
      // Navigation optics are relative to the detail camera root. The root can
      // sit above the stage centre to clear shell chrome; this sibling image
      // must include that same shift. visibleRect names stage edges in root space.
      const rect = viewport.visibleRect;
      const x = center[0] - (rect ? (rect.left + rect.right) / 2 : 0);
      const y = center[1] - (rect ? (rect.top + rect.bottom) / 2 : 0);
      image.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
      // The prepared navigation marker covers subpixel arrivals.
      image.style.opacity = String(Math.min(1, Math.max(0, (2 * projection.silhouette.tangentialSemiAxis - 2) / 12)));
    },
    mounting() { image.dataset.arrivalBillboard = 'mounting'; },
    /** Mount readiness supplies decode + connected activation + rendering opportunities.
     * Browsers expose no promise for GPU residency; device frames qualify this handoff. */
    reveal() {
      if (disposed) return Promise.reject(aborted());
      image.dataset.arrivalBillboard = 'revealing';
      return new Promise<void>((resolve, reject) => {
        rejectPending = reject;
        const start = clock.now();
        const tick = (time: number) => {
          frameId = null;
          const progress = Math.min(1, (time - start) / 200);
          image.style.opacity = String(1 - progress);
          if (progress < 1) frameId = clock.request(tick);
          else { rejectPending = null; destroy(); resolve(); }
        };
        frameId = clock.request(tick);
      });
    },
    destroy,
  };
}
