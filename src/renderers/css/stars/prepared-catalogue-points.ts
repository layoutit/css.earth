import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { parseDensityVolumeFrame } from '@cssearth/objects';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { cssViewFromOrientation } from '../navigation/world-camera-math.js';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { nativeProjectedLength } from '../rendering/native-projection.js';

export interface PreparedCataloguePoint {
  readonly id: string;
  readonly positionUnits: VolumeVector;
  /** Final prepared presentation, including saved size, exposure and support. */
  readonly sizePx: number;
  /** Optional physical footprint; historical catalogue points retain fixed screen sizes. */
  readonly diameterUnits?: number;
  readonly colorCss: string;
  readonly opacity: number;
}
export interface PreparedCataloguePoints {
  readonly frame: DensityVolumeFrame;
  readonly points: readonly PreparedCataloguePoint[];
}

export function validatePreparedCataloguePoints(input: unknown): PreparedCataloguePoints {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Prepared catalogue points must be an object.');
  const value = input as PreparedCataloguePoints;
  const frame = parseDensityVolumeFrame(value.frame);
  if (!Array.isArray(value.points)) throw new TypeError('Prepared catalogue points need a fixed point array.');
  const ids = new Set<string>();
  const points = value.points.map(point => {
    if (!point || typeof point.id !== 'string' || !point.id || ids.has(point.id) ||
        !Array.isArray(point.positionUnits) || point.positionUnits.length !== 3 || !point.positionUnits.every(Number.isFinite) ||
        !Number.isFinite(point.sizePx) || point.sizePx <= 0 ||
        (point.diameterUnits !== undefined && (!Number.isFinite(point.diameterUnits) || point.diameterUnits <= 0)) || !Number.isFinite(point.opacity) || point.opacity < 0 || point.opacity > 1 ||
        typeof point.colorCss !== 'string' || !/^#[0-9a-f]{6}$/iu.test(point.colorCss)) {
      throw new TypeError('Prepared catalogue point identity, position or presentation is invalid.');
    }
    ids.add(point.id);
    return Object.freeze({ id: point.id, positionUnits: Object.freeze([...point.positionUnits]) as VolumeVector,
      sizePx: point.sizePx, ...(point.diameterUnits === undefined ? {} : { diameterUnits: point.diameterUnits }), colorCss: point.colorCss, opacity: point.opacity });
  });
  return Object.freeze({ frame, points: Object.freeze(points) });
}

/** Bounds describe coverage; the physical embedding and point identities must not change with a lens. */
export function samePreparedCatalogueGeometry(left: PreparedCataloguePoints, right: PreparedCataloguePoints): boolean {
  if (!samePreparedPhysicalFrame(left.frame, right.frame) || left.points.length !== right.points.length) return false;
  const points = new Map(right.points.map(point => [point.id, point]));
  return left.points.every(point => {
    const other = points.get(point.id);
    return other && point.positionUnits.every((value, axis) => value === other.positionUnits[axis]);
  });
}

export function samePreparedPhysicalFrame(left: DensityVolumeFrame, right: DensityVolumeFrame): boolean {
  return left.referenceFrame === right.referenceFrame && left.epochJdTt === right.epochJdTt &&
    left.metersPerUnit === right.metersPerUnit && left.originM.every((value, axis) => value === right.originM[axis]) &&
    left.localToReferenceXyzw.every((value, axis) => value === right.localToReferenceXyzw[axis]);
}

/** Retained catalogue geometry. Only camera projection and prepared point presentation enter runtime. */
export function mountPreparedCataloguePoints({ host, before, payload, createElement, nativeFocalCss }: {
  host: HTMLElement; before: Element; payload: PreparedCataloguePoints; createElement?: (tag: string) => HTMLElement; nativeFocalCss?: string;
}) {
  const data = validatePreparedCataloguePoints(payload), document = host.ownerDocument;
  const create = createElement ?? ((tag: string) => document.createElement(tag));
  const root = create('div');
  root.className = 'prepared-catalogue-points'; root.ariaHidden = 'true';
  root.dataset.pointCount = String(data.points.length);
  Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '1' });
  let presentation = data, materials = data.points, destroyed = false, latest: VolumeCameraPublication | null = null;
  const shownState = new Uint8Array(data.points.length).fill(255), writtenTransform: string[] = new Array(data.points.length).fill('');
  const nodes = data.points.map(point => {
    const node = create('s'); node.dataset.catalogueSource = point.id;
    Object.assign(node.style, { position: 'absolute', left: '50%', top: '50%', display: 'block',
      borderRadius: '50%', textDecoration: 'none', visibility: 'hidden' });
    root.append(node); return node;
  });
  const applyPresentation = () => {
    const points = new Map(presentation.points.map(point => [point.id, point]));
    materials = data.points.map(point => points.get(point.id)!);
    data.points.forEach((point, index) => {
      const material = materials[index];
      Object.assign(nodes[index].style, { width: `${material.sizePx}px`, height: `${material.sizePx}px`,
        background: material.colorCss, opacity: String(material.opacity) });
    });
  };
  const publish = (publication: VolumeCameraPublication) => {
    if (destroyed) return;
    const { world, viewport } = publication;
    if (world.referenceFrame !== data.frame.referenceFrame || world.epochJdTt !== data.frame.epochJdTt) {
      throw new TypeError('Prepared catalogue points and camera must share their frame and epoch.');
    }
    const [ox, oy] = viewport.principalOffsetPixels;
    const width = viewport.widthPixels ?? host.clientWidth, height = viewport.heightPixels ?? host.clientHeight;
    if (!(viewport.focalPixels > 0) || ![viewport.focalPixels, ox, oy, width, height].every(Number.isFinite) || width < 0 || height < 0) {
      throw new TypeError('Prepared catalogue point viewport is invalid.');
    }
    latest = publication;
    const local = presentPhysicalPoseInVolume(world.pose, data.frame);
    const rotation = cssViewFromOrientation(local.orientationXyzw);
    let visible = 0;
    // Perspective projection, inlined: no object per point, and only
    // changed visibility and transforms are written to the retained nodes.
    const [ex, ey, ez] = local.positionUnits, focal = viewport.focalPixels;
    const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = rotation;
    for (let index = 0; index < data.points.length; index++) {
      const position = data.points[index].positionUnits, node = nodes[index], material = materials[index];
      const x = position[0] - ex, y = position[1] - ey, z = position[2] - ez;
      const depth = -(r6 * x + r7 * y + r8 * z);
      const size = material.diameterUnits === undefined ? material.sizePx : material.diameterUnits * focal / Math.max(Number.MIN_VALUE, depth);
      const px = ox + focal * (r0 * x + r1 * y + r2 * z) / depth, py = oy + focal * (r3 * x + r4 * y + r5 * z) / depth;
      const shown = materials[index].opacity > 0 && depth > 0 && Math.abs(px) < width / 2 + size && Math.abs(py) < height / 2 + size;
      if (shownState[index] !== Number(shown)) { node.style.visibility = shown ? 'visible' : 'hidden'; shownState[index] = Number(shown); }
      if (shown) {
        visible++;
        const length = (value: number) => nativeFocalCss === undefined ? `${value}px` : nativeProjectedLength(value, focal, nativeFocalCss);
        if (material.diameterUnits !== undefined) node.style.width = node.style.height = length(size);
        const halfSize = material.diameterUnits === undefined ? `${size / 2}px` : length(size / 2);
        const transform = nativeFocalCss === undefined ? `translate(${px - size / 2}px,${py - size / 2}px)`
          : `translate(calc(${ox}px + ${length(px - ox)} - ${halfSize}),calc(${oy}px + ${length(py - oy)} - ${halfSize}))`;
        if (writtenTransform[index] !== transform) { node.style.transform = transform; writtenTransform[index] = transform; }
      }
    }
    const visiblePoints = String(visible);
    if (root.dataset.visiblePoints !== visiblePoints) root.dataset.visiblePoints = visiblePoints;
  };
  applyPresentation(); host.insertBefore(root, before);
  return Object.freeze({ root, publish,
    setPresentation(next: PreparedCataloguePoints) {
      if (destroyed) return;
      const parsed = validatePreparedCataloguePoints(next);
      if (!samePreparedCatalogueGeometry(data, parsed)) throw new TypeError('A catalogue lens must retain the same prepared point geometry.');
      presentation = parsed; applyPresentation();
      if (latest) publish(latest);
    },
    destroy() { if (destroyed) return; destroyed = true; latest = null; root.remove(); },
  });
}
