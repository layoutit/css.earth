import { isArray } from './is-array.mts';
import type { Vector3, Matrix3 } from "../renderers/css/solar-system/types.ts";
// Astrometric registration of the ESO eso0932a all-sky panorama (ESO/S.
// Brunier, 6000 x 3000, CC-BY-4.0), the photographic source of every cubic
// sky in this project.
//
// The panorama is an equirectangular map in galactic coordinates. Its pixel
// convention was settled on the image itself, not assumed: the Magellanic
// Clouds, the Orion Nebula, the Andromeda Galaxy and the Pleiades were
// located as compact bright blobs (local-mean minus wide-mean luminance
// peaks) and all five land where galactic longitude increases LEFTWARD from
// l = 0 at the column centre, with b = +90 at the top row (the inside-the-
// sphere view). Under the mirrored convention none of them is present.
//
// The mosaic's own frame is rotated a few degrees from the true J2000
// galactic frame (a hand-assembled photographic panorama, not a survey map):
// the five anchors miss their nominal pixels by 2.5 to 3.7 degrees with a
// consistent pattern, and a single rigid rotation fitted to them brings every
// residual under 0.3 degrees. That rotation is derived here from the anchor
// list, so the correction is reproducible and mutation-checked, never a
// hand-tuned constant.

import {
  degreesFromDirection,
  directionFromDegrees,
  transformDirection,
} from "./galactic-frame.mts";

export const ESO_PANORAMA = Object.freeze({
  id: "eso0932a",
  title: "The Milky Way panorama",
  credit: "ESO/S. Brunier",
  license: "CC-BY-4.0",
  size: Object.freeze([6000, 3000]),
  projection: "equirectangular-galactic",
  longitudeConvention:
    "l = 0 at the column centre, increasing leftward (sky seen from inside)",
  latitudeConvention: "b = +90 at row 0, -90 at the last row",
});

// Anchor objects with their catalogue galactic coordinates (NED / SIMBAD,
// J2000) and the pixel centroid of their blob in the 6000 x 3000 image,
// measured as the luminance-detail centroid at half resolution (see
// tests/objects/unit/mercury/sky-anchors.test.mjs, which re-measures them).
export const ESO_PANORAMA_ANCHORS = Object.freeze([
  Object.freeze({
    name: "Large Magellanic Cloud",
    galacticDegrees: Object.freeze([280.47, -32.89]),
    pixel: Object.freeze([4367, 2028]),
  }),
  Object.freeze({
    name: "Small Magellanic Cloud",
    galacticDegrees: Object.freeze([302.8, -44.3]),
    pixel: Object.freeze([3995, 2206]),
  }),
  Object.freeze({
    name: "Orion Nebula (M42)",
    galacticDegrees: Object.freeze([209.01, -19.38]),
    pixel: Object.freeze([5566, 1835]),
  }),
  Object.freeze({
    name: "Andromeda Galaxy (M31)",
    galacticDegrees: Object.freeze([121.17, -21.57]),
    pixel: Object.freeze([1038, 1887]),
  }),
  Object.freeze({
    name: "Pleiades (M45)",
    galacticDegrees: Object.freeze([166.57, -23.52]),
    pixel: Object.freeze([272, 1920]),
  }),
]);

// Continuous pixel coordinates: integer values are pixel centres, so pixel
// index x covers [x - 0.5, x + 0.5). The preparation sampler uses the same
// convention when it bilinearly samples the map.
export function panoramaPixelToGalacticDegrees(
  [x, y]: readonly number[],
  [width, height] = ESO_PANORAMA.size,
) {
  const longitude = (0.5 - (x + 0.5) / width) * 360;
  const latitude = 90 - (y + 0.5) / height * 180;
  return [((longitude % 360) + 360) % 360, latitude] as const;
}

export function galacticDegreesToPanoramaPixel(
  [longitudeDegrees, latitudeDegrees]: readonly number[],
  [width, height] = ESO_PANORAMA.size,
) {
  const longitude = ((longitudeDegrees % 360) + 540) % 360 - 180;
  return [
    (0.5 - longitude / 360) * width - 0.5,
    (90 - latitudeDegrees) / 180 * height - 0.5,
  ];
}

// Fits the rigid rotation R with image = R * catalogue (galactic unit
// vectors) by iterated small-angle least squares. Returns row-major R and the
// per-anchor angular residuals before and after the correction.
export function fitPanoramaFrameRotation(anchors = ESO_PANORAMA_ANCHORS) {
  if (!isArray(anchors) || anchors.length < 3) {
    throw new TypeError("Panorama registration needs at least three anchors.");
  }
  const pairs = anchors.map((anchor) => ({
    name: anchor.name,
    catalogue: directionFromDegrees(anchor.galacticDegrees[0], anchor.galacticDegrees[1]),
    image: directionFromDegrees(
      ...panoramaPixelToGalacticDegrees(anchor.pixel),
    ),
  }));
  let rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let iteration = 0; iteration < 4; iteration += 1) {
    // Linearise image ~= (I + [w]x) * rotated: image - rotated = -[rotated]x w.
    const normal = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const right = [0, 0, 0];
    for (const { catalogue, image } of pairs) {
      const p = transformDirection(rotation, catalogue);
      const rows = [
        [0, p[2], -p[1]],
        [-p[2], 0, p[0]],
        [p[1], -p[0], 0],
      ];
      for (let axis = 0; axis < 3; axis += 1) {
        const difference = image[axis] - p[axis];
        for (let i = 0; i < 3; i += 1) {
          right[i] += rows[axis][i] * difference;
          for (let j = 0; j < 3; j += 1) {
            normal[i * 3 + j] += rows[axis][i] * rows[axis][j];
          }
        }
      }
    }
    const step = solve3(normal, right);
    rotation = multiply(rotationFromVector(step), rotation);
  }
  const residualsDegrees = Object.fromEntries(pairs.map(({
    name,
    catalogue,
    image,
  }) => [name, angleBetweenDegrees(transformDirection(rotation, catalogue), image)]));
  const uncorrectedResidualsDegrees = Object.fromEntries(pairs.map(({
    name,
    catalogue,
    image,
  }) => [name, angleBetweenDegrees(catalogue, image)]));
  const { angleDegrees, axis } = axisAngle(rotation);
  return Object.freeze({
    model: "rigid-rotation-least-squares-on-catalogue-anchors",
    matrix: Object.freeze(rotation),
    angleDegrees,
    axisGalacticDegrees: Object.freeze(degreesFromDirection(axis)),
    residualsDegrees: Object.freeze(residualsDegrees),
    maximumResidualDegrees: Math.max(...Object.values(residualsDegrees).map(Number)),
    uncorrectedResidualsDegrees: Object.freeze(uncorrectedResidualsDegrees),
    anchorCount: pairs.length,
  });
}

export const ESO_PANORAMA_REGISTRATION = fitPanoramaFrameRotation();

function angleBetweenDegrees(a: Vector3, b: Vector3) {
  const cosine = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) /
    (Math.hypot(...a) * Math.hypot(...b));
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function rotationFromVector([wx, wy, wz]: Vector3) {
  const angle = Math.hypot(wx, wy, wz);
  if (angle < 1e-15) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const [kx, ky, kz] = [wx / angle, wy / angle, wz / angle];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const c1 = 1 - cos;
  return [
    cos + kx * kx * c1, kx * ky * c1 - kz * sin, kx * kz * c1 + ky * sin,
    ky * kx * c1 + kz * sin, cos + ky * ky * c1, ky * kz * c1 - kx * sin,
    kz * kx * c1 - ky * sin, kz * ky * c1 + kx * sin, cos + kz * kz * c1,
  ];
}

function axisAngle(matrix: Matrix3) {
  const trace = matrix[0] + matrix[4] + matrix[8];
  const angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2)));
  const axis = [
    matrix[7] - matrix[5],
    matrix[2] - matrix[6],
    matrix[3] - matrix[1],
  ];
  const length = Math.hypot(...axis);
  return {
    angleDegrees: angle * 180 / Math.PI,
    axis: length > 0 ? axis.map((value) => value / length) : [0, 0, 1],
  };
}

function solve3(m: Matrix3, r: Vector3) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) +
    c * (d * h - e * g);
  if (!(Math.abs(determinant) > 1e-18)) {
    throw new RangeError("Panorama anchors are degenerate.");
  }
  const inverse = [
    (e * i - f * h) / determinant, (c * h - b * i) / determinant,
    (b * f - c * e) / determinant,
    (f * g - d * i) / determinant, (a * i - c * g) / determinant,
    (c * d - a * f) / determinant,
    (d * h - e * g) / determinant, (b * g - a * h) / determinant,
    (a * e - b * d) / determinant,
  ];
  return transformDirection(inverse, r);
}

function multiply(a: Matrix3, b: Matrix3) {
  const result = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    }
  }
  return result;
}
