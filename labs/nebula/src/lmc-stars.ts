/** Retained catalogue points: runtime projects prepared XYZ only, never source astrometry. */
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { projectPreparedPoint } from '../../../src/renderers/css/stars/prepared-point-field-runtime';
import { transposeWorldRotation, worldRotationFromQuaternion } from '../../../src/renderers/css/navigation/world-camera-math';
import type { WorldCameraPose, WorldCameraViewport } from '../../../src/renderers/css/navigation/world-camera';

export interface PreparedLmcStar {
  id: string; raDeg: number; decDeg: number; magnitude: number; colorIndexBv: number | null; spectralType: string;
  positionUnits: [number, number, number]; sizePx: number; colorCss: string; opacity: number;
}
export interface PreparedLmcStars {
  schema: 'cssearth-lmc-stars@1'; id: 'lmc-stars'; frame: DensityVolumeFrame;
  magnitudeBand: 'V'; stars: PreparedLmcStar[]; sourceUrl: string; credit: string; depthAssumption: string; provenance: unknown;
}
const finiteArray = (v: unknown, length: number): v is number[] =>
  Array.isArray(v) && v.length === length && v.every(Number.isFinite);

export function parsePreparedLmcStars(value: unknown, expectedFrame: DensityVolumeFrame): PreparedLmcStars {
  const payload = value as PreparedLmcStars;
  if (!payload || payload.schema !== 'cssearth-lmc-stars@1' || payload.id !== 'lmc-stars' ||
      payload.magnitudeBand !== 'V' || !payload.frame || !Array.isArray(payload.stars) || payload.stars.length < 1 || payload.stars.length > 2000 ||
      typeof payload.sourceUrl !== 'string' || !payload.sourceUrl.startsWith('https://') ||
      typeof payload.credit !== 'string' || typeof payload.depthAssumption !== 'string') throw new TypeError('Invalid prepared LMC star catalogue.');
  const f = payload.frame;
  if (!finiteArray(f.originM, 3) || !finiteArray(f.localToReferenceXyzw, 4) || !Number.isFinite(f.metersPerUnit) || f.metersPerUnit <= 0 ||
      Math.abs(Math.hypot(...f.localToReferenceXyzw) - 1) > 1e-10) throw new TypeError('Invalid prepared star frame.');
  for (const key of ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit'] as const)
    if (JSON.stringify(f[key]) !== JSON.stringify(expectedFrame[key])) throw new TypeError('Prepared stars and cloud use different physical frames.');
  const ids = new Set<string>();
  for (const star of payload.stars) {
    if (!star || typeof star.id !== 'string' || !star.id.startsWith('Bonanos2009:') || star.id.length > 100 || ids.has(star.id) ||
        typeof star.spectralType !== 'string' || !finiteArray(star.positionUnits, 3) || !Number.isFinite(star.raDeg) || star.raDeg < 0 || star.raDeg >= 360 ||
        !Number.isFinite(star.decDeg) || Math.abs(star.decDeg) > 90 || !Number.isFinite(star.magnitude) ||
        !(star.colorIndexBv === null || Number.isFinite(star.colorIndexBv)) || !Number.isFinite(star.sizePx) || star.sizePx < .5 || star.sizePx > 4 ||
        !Number.isFinite(star.opacity) || star.opacity < 0 || star.opacity > 1 || !/^#[0-9a-f]{6}$/i.test(star.colorCss))
      throw new TypeError('Invalid prepared LMC star point.');
    ids.add(star.id);
  }
  return payload;
}

export function mountPreparedLmcStars({ host, payload, before = null }: {
  host: HTMLElement; payload: PreparedLmcStars; before?: Node | null;
}) {
  parsePreparedLmcStars(payload, payload.frame);
  const root = host.ownerDocument.createElement('div'); root.className = 'prepared-lmc-stars'; root.ariaHidden = 'true';
  root.dataset.starCount = String(payload.stars.length);
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1';
  const nodes = payload.stars.map(star => {
    const node = host.ownerDocument.createElement('s'); node.dataset.catalogueSource = star.id;
    node.style.cssText = `position:absolute;left:50%;top:50%;display:block;width:${star.sizePx}px;height:${star.sizePx}px;border-radius:50%;background:${star.colorCss};opacity:${star.opacity};visibility:hidden;text-decoration:none`;
    root.append(node); return node;
  });
  host.insertBefore(root, before);
  let enabled = true, destroyed = false, visibleCount = 0;
  const publish = ({ world, viewport }: { world: WorldCameraPose; viewport: WorldCameraViewport }) => {
    if (destroyed) return;
    if (world.referenceFrame !== payload.frame.referenceFrame || world.epochJdTt !== payload.frame.epochJdTt)
      throw new TypeError('Prepared stars and camera must share a frame and epoch.');
    const local = presentPhysicalPoseInVolume(world.pose, payload.frame);
    const rotation = transposeWorldRotation(worldRotationFromQuaternion(local.orientationXyzw));
    const [ox, oy] = viewport.principalOffsetPixels, focal = viewport.focalPixels;
    if (!(focal > 0) || ![focal, ox, oy].every(Number.isFinite)) throw new TypeError('Invalid star camera viewport.');
    const halfWidth = (viewport.widthPixels ?? host.clientWidth) / 2, halfHeight = (viewport.heightPixels ?? host.clientHeight) / 2;
    visibleCount = 0;
    payload.stars.forEach((star, index) => {
      const p = projectPreparedPoint(star.positionUnits, local.positionUnits, rotation, focal, ox, oy), node = nodes[index]!;
      const shown = p.depth > 0 && Math.abs(p.x) < halfWidth + star.sizePx && Math.abs(p.y) < halfHeight + star.sizePx;
      node.style.visibility = shown ? '' : 'hidden';
      if (shown) {
        visibleCount++;
        // CSS Y and the parent east-left reflection follow the same convention as the existing point renderer.
        node.style.transform = `translate(${p.x - star.sizePx / 2}px,${p.y - star.sizePx / 2}px)`;
      }
    });
    root.dataset.visibleStars = String(enabled ? visibleCount : 0);
  };
  return Object.freeze({ root, count: payload.stars.length,
    magnitudeRange: [Math.min(...payload.stars.map(s => s.magnitude)), Math.max(...payload.stars.map(s => s.magnitude))] as [number, number],
    publish,
    setVisible(value: boolean) { enabled = value; root.style.visibility = value ? '' : 'hidden';
      // Explicit child visibility can escape a hidden parent, so hide the root's display as one retained layer.
      root.style.display = value ? 'block' : 'none'; root.dataset.visibleStars = String(value ? visibleCount : 0); },
    destroy() { if (destroyed) return; destroyed = true; root.remove(); },
  });
}
