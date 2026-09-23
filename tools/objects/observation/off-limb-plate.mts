/** The off-limb plate of a surface-observation lens: the frame's own light outside the body's silhouette, registered to the disc.
 *
 * The plate is the sky-plane image resampled so the body's disc has the emission plate's body diameter, rotated by the authored
 * angle that carries image-up (celestial north) to its screen direction at the default camera, and coloured through the lens's
 * palette on the lens's display stretch. Alpha follows the light: fully opaque at the stretch's low end, fading to transparent as
 * the light falls to the frame's background maximum, so the halo is as faint as the reconstruction says. The part of the plate
 * inside the disc is hidden behind the sphere at runtime. */
import { interpolatePalette } from '../color-transfer.mts';

export interface OffLimbSource {
  readonly width: number; readonly height: number;
  /** Row-major values with row 0 at the top, as the camera route presents the frame. */
  readonly values: ArrayLike<number>;
  /** Disc centre in pixel coordinates (top-down rows) and the disc radius in pixels. */
  readonly center: readonly [number, number]; readonly discRadiusPx: number;
  readonly backgroundMaximum: number;
}
/** `opaqueAt`: the light at which alpha reaches 1, from the background maximum; the stretch low when absent. */
/** `edgeFeatherPixels`: opacity falls to zero over this many frame pixels at the frame's edge, so a frame whose light reaches its
 * edge does not end in a line. A presentation choice; the light values are unchanged. */
export interface OffLimbDisplay { readonly low: number; readonly high: number; readonly palette: readonly string[]; readonly rotationDegrees: number; readonly opaqueAt?: number; readonly edgeFeatherPixels?: number }

export function offLimbPlate(source: OffLimbSource, display: OffLimbDisplay, size: number, bodyDiameterPx: number): Uint8Array {
  if (!(size > 0) || !(bodyDiameterPx > 0) || !(source.discRadiusPx > 0) || !(display.high > display.low) || !(display.low > 0)) throw new TypeError('An off-limb plate needs positive sizes and a display stretch.');
  const data = new Uint8Array(size * size * 4);
  const scale = source.discRadiusPx / (bodyDiameterPx / 2), theta = display.rotationDegrees * Math.PI / 180, cos = Math.cos(theta), sin = Math.sin(theta);
  const sample = (x: number, y: number) => {
    // Bilinear on the frame; outside the frame there is no light.
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (col: number, row: number) => col < 0 || row < 0 || col >= source.width || row >= source.height ? 0 : Number(source.values[row * source.width + col]);
    return at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
  };
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const sx = px + 0.5 - size / 2, sy = py + 0.5 - size / 2;
    // Undo the screen rotation (counterclockwise on a y-down screen), then scale to frame pixels.
    const ix = (sx * cos - sy * sin) * scale + source.center[0], iy = (sx * sin + sy * cos) * scale + source.center[1];
    const value = sample(ix - 0.5, iy - 0.5);
    if (!(value > source.backgroundMaximum)) continue;
    const level = Math.max(0, Math.min(1, (value - display.low) / (display.high - display.low)));
    const edge = display.edgeFeatherPixels ? Math.max(0, Math.min(1, Math.min(ix, iy, source.width - ix, source.height - iy) / display.edgeFeatherPixels)) : 1;
    const alpha = Math.round(255 * edge * edge * (3 - 2 * edge) * Math.max(0, Math.min(1, (value - source.backgroundMaximum) / ((display.opaqueAt ?? display.low) - source.backgroundMaximum))));
    const [r, g, b] = interpolatePalette(display.palette, level);
    data.set([r!, g!, b!, alpha], (py * size + px) * 4);
  }
  return data;
}
