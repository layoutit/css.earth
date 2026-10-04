import { validatePreparedCataloguePoints, type PreparedCataloguePoints, samePreparedCatalogueGeometry } from '@cssearth/objects';
import { writeStyle } from '../rendering/retained-write.js';
import { presentPhysicalPoseInVolume, cssViewFromOrientation } from '@cssearth/engine';
import type { VolumeCameraPublication } from '../volume/types.js';
import { nativeProjectedLength } from '../rendering/native-projection.js';

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
      // The size goes through the same writer as a projected size below: a direct write here would leave that writer
      // remembering the size it last projected, and it would skip writing it again after a dataset switch.
      writeStyle(nodes[index], 'width', `${material.sizePx}px`); writeStyle(nodes[index], 'height', `${material.sizePx}px`);
      Object.assign(nodes[index].style, { background: material.colorCss, opacity: String(material.opacity) });
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
        if (material.diameterUnits !== undefined) { const side = length(size); writeStyle(node, 'width', side); writeStyle(node, 'height', side); }
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
      if (!samePreparedCatalogueGeometry(data, parsed)) throw new TypeError('A catalogue dataset must retain the same prepared point geometry.');
      presentation = parsed; applyPresentation();
      if (latest) publish(latest);
    },
    destroy() { if (destroyed) return; destroyed = true; latest = null; root.remove(); },
  });
}
