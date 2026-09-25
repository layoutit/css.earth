import type { SkyBounds } from '@cssearth/bake/volume';
import type { ViewFraming as ShapeCloudFraming } from './framing.ts';

export interface CompilerInspectionFrame { boundsArcsec: SkyBounds; paddingPixels?: number }
export interface CompilerViewport { width: number; height: number }

function validate(input: CompilerInspectionFrame, viewport: CompilerViewport) {
  const { min, max } = input.boundsArcsec, padding = input.paddingPixels ?? 18;
  if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 2 || max.length !== 2 ||
      min.some((n, i) => !Number.isFinite(n) || !Number.isFinite(max[i]) || n >= max[i]!) ||
      !Number.isFinite(padding) || padding < 0 || ![viewport.width, viewport.height].every(Number.isFinite) ||
      viewport.width <= 2 * padding || viewport.height <= 2 * padding) throw new TypeError('Invalid compiler inspection frame.');
  return padding;
}

/** Matches Alignment's full-footprint fit while retaining the volume's centered local coordinates. */
export function compilerInspectionCamera(input: CompilerInspectionFrame, localOriginArcsec: readonly [number, number, number],
  viewport: CompilerViewport, framing: ShapeCloudFraming, yawDegrees: number, pitchDegrees: number) {
  const padding = validate(input, viewport), { min, max } = input.boundsArcsec;
  if (localOriginArcsec.length !== 3 || !localOriginArcsec.every(Number.isFinite) || !Number.isFinite(framing.zoom) || framing.zoom <= 0 ||
      ![framing.panX, framing.panY, yawDegrees, pitchDegrees].every(Number.isFinite)) throw new TypeError('Invalid compiler inspection pose.');
  const spanX = max[0] - min[0], spanY = max[1] - min[1];
  const pixelsPerArcsec = Math.min((viewport.width - 2 * padding) / spanX, (viewport.height - 2 * padding) / spanY) * framing.zoom;
  // shapeCloudOrthographicCamera applies its established .94 fit. These
  // effective dimensions make that fit exactly equal the 18px Alignment inset.
  const image = { width: spanX * viewport.width * .94 / (viewport.width - 2 * padding),
    height: spanY * viewport.height * .94 / (viewport.height - 2 * padding), unitsPerPixel: 1 };
  const centerX = (min[0] + max[0]) / 2, centerY = (min[1] + max[1]) / 2;
  const yaw = yawDegrees * Math.PI / 180, pitch = pitchDegrees * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const project = (xWest: number, yNorth: number, zAway: number): [number, number] => {
    const x = xWest - centerX, y = yNorth - centerY;
    return [framing.panX + (cy * x - sy * zAway) * pixelsPerArcsec,
      framing.panY + (sp * sy * x - cp * y + sp * cy * zAway) * pixelsPerArcsec];
  };
  const centerLocal: [number, number, number] = [centerX - localOriginArcsec[0], centerY - localOriginArcsec[1], -localOriginArcsec[2]];
  const centerScreen = [
    (cy * centerLocal[0] - sy * centerLocal[2]) * pixelsPerArcsec,
    (sp * sy * centerLocal[0] - cp * centerLocal[1] + sp * cy * centerLocal[2]) * pixelsPerArcsec,
  ];
  return { image, pixelsPerArcsec, centerArcsec: [centerX, centerY] as [number, number], project,
    framing: { ...framing, panX: framing.panX - centerScreen[0]!, panY: framing.panY - centerScreen[1]! } };
}
