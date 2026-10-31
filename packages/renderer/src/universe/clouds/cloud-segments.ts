import { presentPhysicalPoseInVolume, cssCameraAxesFromOrientation } from '@cssearth/engine';
import type { PreparedCloudSegments } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../../volume/types.js';
import { OCCLUDED_FLOOR, occluderDepth } from './cloud-occluder.js';
import { retainedStyle, type CloudOverlayLayer } from './cloud-overlay-layer.js';

/** A line element's own length, scaled to the line's on screen; an arrowhead is this many line widths long. */
const BASE_PX = 100, HEAD_WIDTHS = 4;

/**
 * Cloud segments (@cssearth/objects cloud-segments.ts) as one element a line, and one more a line that ends in an
 * arrowhead: each publication places a line from its start's place on screen to its end's, its arrowhead at its end, and
 * dims it by how deep the sight line to its middle passes through the occluder. A moving camera changes only each
 * element's transform and opacity, each written only when it changes; a line with an end behind the eye is not drawn. Its
 * owner (cloud-points.ts `mountCloudOverlay`) attaches and detaches it.
 */
export function createCloudSegments({ host, lines }: { host: HTMLElement; lines: PreparedCloudSegments }): CloudOverlayLayer {
  const doc = host.ownerDocument, depthThrough = occluderDepth(lines.occluder), width = lines.widthPixels, head = HEAD_WIDTHS * width;
  const root = doc.createElement('div'); root.className = 'prepared-cloud-segments'; root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
  root.dataset.cloudSegments = String(lines.count);
  const color = (i: number) => `rgb(${lines.rgba[i * 4]},${lines.rgba[i * 4 + 1]},${lines.rgba[i * 4 + 2]})`;
  const items = Array.from({ length: lines.count }, (_, i) => {
    const line = doc.createElement('div');
    line.style.cssText = `position:absolute;left:0;top:0;width:${BASE_PX}px;height:${width}px;background:${color(i)};transform-origin:0 50%;will-change:transform,opacity`;
    root.append(line);
    let tip: HTMLDivElement | null = null;
    if (lines.heads[i]) {
      // a triangle of borders pointing along +x, its tip at the element's right edge
      tip = doc.createElement('div');
      tip.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;border-left:${head}px solid ${color(i)};border-top:${head / 2.4}px solid transparent;border-bottom:${head / 2.4}px solid transparent;transform-origin:${head}px 50%;will-change:transform,opacity`;
      root.append(tip);
    }
    return { lineStyle: retainedStyle(line), tipStyle: tip ? retainedStyle(tip) : null, alpha: lines.rgba[i * 4 + 3]! / 255 };
  });
  // its caption, the world's own label (prepared-context-label), centred on its place
  const label = lines.label ? doc.createElement('span') : null;
  if (label) { label.className = 'prepared-context-label'; label.textContent = lines.label!.text; label.style.cssText = 'position:absolute;left:0;top:0;will-change:transform,opacity'; root.append(label); }
  const labelStyle = label ? retainedStyle(label) : null;
  function place(publication: VolumeCameraPublication) {
    const local = presentPhysicalPoseInVolume(publication.world.pose, lines.frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const [px, py, pz] = local.positionUnits, focal = publication.viewport.focalPixels, [ox, oy] = publication.viewport.principalOffsetPixels;
    const w = (publication.viewport.widthPixels ?? host.clientWidth) / 2, h = (publication.viewport.heightPixels ?? host.clientHeight) / 2;
    const screen = (P: Float64Array, i: number) => {
      const x = P[i * 3]! - px, y = P[i * 3 + 1]! - py, z = P[i * 3 + 2]! - pz, depth = -(r[2] * x + r[5] * y + r[8] * z);
      return depth > 0 ? [focal * (r[0] * x + r[3] * y + r[6] * z) / depth + ox + w, focal * (r[1] * x + r[4] * y + r[7] * z) / depth + oy + h] : null;
    };
    if (labelStyle) {
      const at = lines.label!.atUnits, x = at[0] - px, y = at[1] - py, z = at[2] - pz, depth = -(r[2] * x + r[5] * y + r[8] * z);
      if (depth > 0) {
        const sx = focal * (r[0] * x + r[3] * y + r[6] * z) / depth + ox + w, sy = focal * (r[1] * x + r[4] * y + r[7] * z) / depth + oy + h;
        labelStyle.transform(`translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,-50%)`); labelStyle.opacity('1');
      } else labelStyle.opacity('0');
    }
    items.forEach(({ lineStyle, tipStyle, alpha }, i) => {
      const a = screen(lines.from, i), b = screen(lines.to, i);
      if (!a || !b) { lineStyle.opacity('0'); tipStyle?.opacity('0'); return; }
      const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, length = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
      const mid = [0, 1, 2].map(k => (lines.from[i * 3 + k]! + lines.to[i * 3 + k]!) / 2);
      const seen = (alpha * (1 - (1 - OCCLUDED_FLOOR) * depthThrough(px, py, pz, mid[0]! - px, mid[1]! - py, mid[2]! - pz))).toFixed(3);
      // the line stops where its arrowhead starts
      const body = tipStyle ? Math.max(0, length - head) : length;
      lineStyle.transform(`translate3d(${a[0]!.toFixed(1)}px,${(a[1]! - width / 2).toFixed(1)}px,0) rotate(${angle.toFixed(4)}rad) scaleX(${(body / BASE_PX).toFixed(4)})`);
      lineStyle.opacity(seen);
      if (tipStyle) {
        tipStyle.transform(`translate3d(${(b[0]! - head).toFixed(1)}px,${(b[1]! - head / 2.4).toFixed(1)}px,0) rotate(${angle.toFixed(4)}rad)`);
        tipStyle.opacity(length > head ? seen : '0');
      }
    });
  }
  return { root, place };
}
