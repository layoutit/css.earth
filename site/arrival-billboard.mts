import { type PreparedWorldCameraFrame, type PreparedArrivalView } from '@cssearth/objects';
import { worldCameraFromCenteredPresentation, type WorldCameraPose } from '@cssearth/engine';
import { presentWorldCamera, worldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import type { WorldCameraViewport } from '@cssearth/renderer/navigation/world-camera.ts';
import { billboardBodyRadiusPixels } from '@cssearth/renderer/navigation/prepared-body-billboards.ts';
import type { VisibleRect } from '@cssearth/engine';

type BillboardViewport = WorldCameraViewport & { readonly visibleRect: VisibleRect | null };

/** Fit the prepared perspective with the camera lens, keeping its photographed
 * distance and orientation identical on every viewport. */
export function frameArrivalBillboard(arrival: PreparedArrivalView, target: WorldCameraPose,
  frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport): WorldCameraPose {
  const asset = arrival.billboard, projection = presentWorldCamera(target, frame, viewport);
  if (!asset || !projection.silhouette) return target;
  const focal = projection.silhouette.tangentialSemiAxis *
    Math.sqrt(asset.distanceM ** 2 - frame.bodyRadiusM ** 2) / frame.bodyRadiusM;
  const projectionScale = focal / (viewport.focalPixels / (viewport.projectionScale ?? 1));
  return worldCameraFromCenteredPresentation({ rotation: arrival.rotation, distanceUnits: asset.distanceM / frame.metersPerUnit },
    frame, worldCameraViewport({ projectionScale }, viewport));
}

/** An opaque cover requires the same final distance and orientation as its bake. */
export function canUseArrivalBillboard(arrival: PreparedArrivalView | undefined, target: WorldCameraPose,
  frame: PreparedWorldCameraFrame, viewport: WorldCameraViewport, dataset?: string | null): boolean {
  if (!arrival?.billboard || (dataset ?? arrival.defaultDataset) !== arrival.defaultDataset) return false;
  const projection = presentWorldCamera(target, frame, viewport);
  if (Math.abs(projection.distanceM / arrival.billboard.distanceM - 1) > 1e-5 ||
      projection.rotation.some((value, index) => Math.abs(value - arrival.rotation[index]!) >= 1e-8) ||
      // Subtracting remote world positions can leave a tiny centring residue.
      // Judge it in visible pixels, rather than body-dependent scene units.
      !projection.centerPixels || Math.hypot(...projection.centerPixels) > 0.5) return false;
  return true;
}

/** A retained image survives the detailed scene replacement. Its projection follows
 * the same acknowledged world camera; only transform and opacity change in flight. */
export async function prepareArrivalBillboard(stage: HTMLElement, arrival: PreparedArrivalView,
  frame: PreparedWorldCameraFrame, signal: AbortSignal, existing?: HTMLImageElement) {
  const asset = arrival.billboard;
  if (!asset) throw new Error('Arrival billboard is not prepared.');
  const document = stage.ownerDocument, window = document.defaultView;
  if (!window) throw new Error('Arrival billboard requires a window.');
  const image = existing ?? document.createElement('img');
  image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.draggable = false;
  image.dataset.arrivalBillboard = 'flight';
  Object.assign(image.style, { position: 'absolute', left: '50%', top: '50%', width: `${asset.size}px`,
    height: `${asset.size}px`, maxWidth: 'none', margin: '0', transformOrigin: '50% 50%',
    pointerEvents: 'none', zIndex: '2147483646',
    // The page's cover already shows this image in the same place (startup-cover.mts); hiding it would blink.
    opacity: existing?.dataset.startupCover === 'shown' ? existing.style.opacity : '0' });
  let disposed = false, rejectPending: ((reason: unknown) => void) | null = null;
  const aborted = () => signal.reason ?? new DOMException('Arrival cancelled.', 'AbortError');
  function destroy() {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', cancel);
    image.remove(); image.removeAttribute('src');
    rejectPending?.(aborted()); rejectPending = null;
  }
  function cancel() { destroy(); }
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) { destroy(); throw aborted(); }
  if (!existing) image.src = asset.url;
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
      // Use the same projected silhouette as the mesh. Scaling only by centre depth
      // underestimates its size as the camera approaches the near surface.
      const preparedRadius = billboardBodyRadiusPixels(asset, frame.bodyRadiusM);
      const scale = projection.silhouette.tangentialSemiAxis / preparedRadius;
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
    destroy,
  };
}
