import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssViewFromOrientation } from '../navigation/world-camera-math.js';
import type { PreparedContextPoint } from '../prepared-data/world-context.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import type { OpacityClock } from '../stars/opacity-clock.js';

const MAX_MESH_GAP_PX = 40;
const MESH_GAP_RADIUS_RATIO = 0.14;
const POINT_RADIUS_PX = 8;
const VIEWPORT_EDGE_PX = 4;
const HEADER_CLEARANCE_PX = 64;
const FOOTER_CLEARANCE_PX = 30;

/** One retained caption follows the selected body from point marker through detailed mesh. */
export function mountSelectedBodyLabel(host: HTMLElement, opacityClock: OpacityClock) {
  const label = host.ownerDocument.createElement('span');
  label.className = 'prepared-context-label prepared-selected-body-label';
  label.ariaHidden = 'true';
  label.style.cssText = 'position:absolute;left:50%;top:50%;opacity:0;pointer-events:none';
  host.appendChild(label);
  const fader = createOpacityFader(host.ownerDocument.defaultView!, opacityClock);
  let measuredId = '', width = 0, height = 0;
  const hide = () => { fader.set(label, 0); return null; };
  return Object.freeze({ label,
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, body: PreparedContextPoint,
      { overview, focused, preview }: {
        overview: boolean; focused: boolean; preview: string | null | undefined;
      }): LabelScreenRect | null {
      if (overview || focused || preview !== undefined && preview !== body.id) return hide();
      const widthPixels = viewport.widthPixels, heightPixels = viewport.heightPixels;
      // The caption stays below the shell header where the viewport measures one, else below a fixed clearance.
      const headerClearance = viewport.coveredTopPixels ?? HEADER_CLEARANCE_PX;
      if (!(widthPixels && heightPixels && viewport.focalPixels > 0)) return hide();
      const delta = body.positionM.map((value, axis) => value - world.pose.positionM[axis]!);
      const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
      const eyeX = rotation[0]! * delta[0]! + rotation[1]! * delta[1]! + rotation[2]! * delta[2]!;
      const eyeY = rotation[3]! * delta[0]! + rotation[4]! * delta[1]! + rotation[5]! * delta[2]!;
      const depth = -(rotation[6]! * delta[0]! + rotation[7]! * delta[1]! + rotation[8]! * delta[2]!);
      if (depth <= body.radiusM) return hide();
      const radiusPixels = viewport.focalPixels * body.radiusM / Math.sqrt(depth * depth - body.radiusM * body.radiusM);
      if (!Number.isFinite(radiusPixels)) return hide();
      const x = viewport.principalOffsetPixels[0] + viewport.focalPixels * eyeX / depth;
      const y = viewport.principalOffsetPixels[1] + viewport.focalPixels * eyeY / depth;
      if (x + radiusPixels < -widthPixels / 2 || x - radiusPixels > widthPixels / 2 ||
          y + radiusPixels < -heightPixels / 2 || y - radiusPixels > heightPixels / 2) return hide();
      if (measuredId !== body.id) {
        label.textContent = body.name;
        label.dataset.selectedBodyLabel = body.id;
        measuredId = body.id;
        width = label.offsetWidth;
        height = label.offsetHeight;
      }
      if (width + 2 * VIEWPORT_EDGE_PX > widthPixels || height + FOOTER_CLEARANCE_PX > heightPixels) return hide();
      const visualRadius = Math.max(radiusPixels, POINT_RADIUS_PX);
      const meshBottom = y + visualRadius;
      const maxTop = heightPixels / 2 - height - FOOTER_CLEARANCE_PX;
      const gap = Math.min(MAX_MESH_GAP_PX, 4 + radiusPixels * MESH_GAP_RADIUS_RATIO);
      const minimumGap = Math.min(16, gap);
      let left: number, top: number;
      if ('labelPlacement' in body && body.labelPlacement === 'centre' && radiusPixels > height) {
        // The package asks for its caption over the body's middle (Sgr A*'s black shadow), once the disc can hold it.
        left = Math.max(-widthPixels / 2 + width / 2 + VIEWPORT_EDGE_PX, Math.min(x, widthPixels / 2 - width / 2 - VIEWPORT_EDGE_PX));
        top = Math.max(-heightPixels / 2 + headerClearance, Math.min(y - height / 2, maxTop));
      } else if (meshBottom + minimumGap <= maxTop) {
        left = Math.max(-widthPixels / 2 + width / 2 + VIEWPORT_EDGE_PX,
          Math.min(x, widthPixels / 2 - width / 2 - VIEWPORT_EDGE_PX));
        top = Math.min(meshBottom + gap, maxTop);
        if (top < -heightPixels / 2 + headerClearance) return hide();
      } else {
        // Once the caption cannot sit clear below the body, the body is the view: its name is in the sheet.
        return hide();
      }
      const transform = `translate(${Number(left.toFixed(3))}px,${Number(top.toFixed(3))}px) translate(-50%,0)`;
      if (label.style.transform !== transform) label.style.transform = transform;
      fader.set(label, DEFAULT_CONTEXT_LABEL_OPACITY);
      return { left: left - width / 2, right: left + width / 2, top, bottom: top + height };
    },
    destroy() { fader.destroy(); label.remove(); },
  });
}
