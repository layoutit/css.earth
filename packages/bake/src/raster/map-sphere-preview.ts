import { limbOverlay } from '../photometry/index.ts';

type Vector3 = [number, number, number];
type Rgb = readonly [number, number, number];

/** How a map sphere's dataset picture is taken: from far away (orthographic), along a line `elevationDeg` above the ICRS
 * equator at right ascension `azimuthDeg`, ICRS north up, `sizePx` square, each pixel the mean of `samples`² rays. */
export interface MapSpherePreviewView { readonly sizePx: number; readonly elevationDeg: number; readonly azimuthDeg: number; readonly samples: number }

/** What a picture shows, as the page draws it (packages/renderer/src/universe/image-mesh.ts): the whole shell, or the shell
 * with one hemisphere open, the rest's outside at `exteriorOpacity` and the inside of its far wall at `interiorOpacity`. */
export type MapSpherePreviewCut = { readonly hemisphere: 'north' | 'south'; readonly interiorOpacity: number; readonly exteriorOpacity: number } | null;

/** The picture's rays: for each sample inside the disc, the directions (unit vectors in the sphere's frame) of the near and
 * the far surface points, and the cosine of the view angle at the near one. */
export function mapSpherePreviewRays({ sizePx, elevationDeg, azimuthDeg, samples }: MapSpherePreviewView) {
  const radians = Math.PI / 180, e = elevationDeg * radians, a = azimuthDeg * radians;
  const toward: Vector3 = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
  const forward = toward.map(value => -value) as Vector3;
  const right = normalise(cross(forward, [0, 0, 1])), up = cross(right, forward);
  const side = sizePx * samples, near = new Float64Array(side * side * 3), far = new Float64Array(side * side * 3);
  const mu = new Float64Array(side * side).fill(-1);
  for (let row = 0; row < side; row++) for (let column = 0; column < side; column++) {
    const x = (column + 0.5) / side * 2 - 1, y = 1 - (row + 0.5) / side * 2, rho2 = x * x + y * y;
    if (rho2 >= 1) continue;
    const depth = Math.sqrt(1 - rho2), k = row * side + column;
    for (let axis = 0; axis < 3; axis++) {
      const onPlane = x * right[axis]! + y * up[axis]!;
      near[k * 3 + axis] = onPlane + depth * toward[axis]!;
      far[k * 3 + axis] = onPlane - depth * toward[axis]!;
    }
    mu[k] = depth;
  }
  return { side, near, far, mu };
}

/** Compose the picture from the sampled colours of the near and far points, as the page stacks them: over black space the
 * inside copy (both faces of the shell that stays, the nearer in front) at the interior opacity, then the outside (the
 * near face that stays, under the limb plate's overlay) at the exterior opacity; the whole shell is the outside alone at
 * full opacity. Outside the disc the picture is transparent. Returns straight RGBA bytes, `sizePx` square. */
export function composeMapSpherePreview({ view, rays, nearColours, farColours, limb, cut }: {
  view: MapSpherePreviewView; rays: ReturnType<typeof mapSpherePreviewRays>;
  nearColours: Uint8Array; farColours: Uint8Array;
  limb: { readonly coefficient: number; readonly referenceColour: Rgb } | null; cut: MapSpherePreviewCut;
}): Buffer {
  const { sizePx, samples } = view, { side, near, far, mu } = rays;
  const opened = (k: number, points: Float64Array) => cut !== null && (cut.hemisphere === 'north' ? points[k * 3 + 2]! > 0 : points[k * 3 + 2]! < 0);
  const colour = (bytes: Uint8Array, k: number): Rgb => [bytes[k * 3]!, bytes[k * 3 + 1]!, bytes[k * 3 + 2]!];
  const over = (top: Rgb, alpha: number, base: Rgb): Rgb => [0, 1, 2].map(c => top[c]! * alpha + base[c]! * (1 - alpha)) as unknown as Rgb;
  const out = Buffer.alloc(sizePx * sizePx * 4);
  for (let py = 0; py < sizePx; py++) for (let px = 0; px < sizePx; px++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const k = (py * samples + sy) * side + px * samples + sx;
      if (mu[k]! < 0) continue;
      // The outside layer: the near face unless it is open, then the limb plate's overlay over the whole disc.
      let outside: Rgb | null = opened(k, near) ? null : colour(nearColours, k), outsideAlpha = outside ? 1 : 0;
      if (limb) {
        const factor = 1 - limb.coefficient * (1 - mu[k]!), [r, g, b, a] = limbOverlay([factor, factor, factor], limb.referenceColour);
        // Over a drawn face the layer stays opaque; over the opening it is the overlay alone, at its own alpha.
        if (outside) outside = over([r, g, b], a, outside);
        else if (a > 0) { outside = [r, g, b]; outsideAlpha = a; }
      }
      let pixel: Rgb = [0, 0, 0];
      if (cut) {
        // The inside copy: the nearer face that stays in front of the farther one.
        const inside = !opened(k, near) ? colour(nearColours, k) : !opened(k, far) ? colour(farColours, k) : null;
        if (inside) pixel = over(inside, cut.interiorOpacity, pixel);
        if (outside) pixel = over(outside, outsideAlpha * cut.exteriorOpacity, pixel);
      } else if (outside) pixel = over(outside, outsideAlpha, pixel);
      sum[0]! += pixel[0]; sum[1]! += pixel[1]; sum[2]! += pixel[2]; sum[3]! += 1;
    }
    // Colour over black inside the disc; the edge's coverage becomes alpha, so the picture sits on any card.
    const coverage = sum[3]! / (samples * samples), offset = (py * sizePx + px) * 4;
    if (!coverage) continue;
    out.set([0, 1, 2].map(c => Math.round(sum[c]! / sum[3]!)), offset);
    out[offset + 3] = Math.round(coverage * 255);
  }
  return out;
}

const cross = (u: Vector3, v: Vector3): Vector3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const normalise = (v: Vector3): Vector3 => { const length = Math.hypot(...v); return v.map(value => value / length) as Vector3; };
