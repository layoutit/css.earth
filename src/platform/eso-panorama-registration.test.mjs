import assert from "node:assert/strict";
import test from "node:test";

import {
  ESO_PANORAMA,
  ESO_PANORAMA_ANCHORS,
  ESO_PANORAMA_REGISTRATION,
  fitPanoramaFrameRotation,
  galacticDegreesToPanoramaPixel,
  panoramaPixelToGalacticDegrees,
} from "./eso-panorama-registration.mjs";
import { directionFromDegrees, transformDirection } from
  "./galactic-frame.mjs";

test("pixel mapping: galactic longitude increases leftward, latitude upward", () => {
  const [width, height] = ESO_PANORAMA.size;
  assert.deepEqual(ESO_PANORAMA.size, [6000, 3000]);
  // Column centre is l = 0; one pixel to the left is a larger longitude.
  const centre = panoramaPixelToGalacticDegrees([width / 2 - 0.5, height / 2 - 0.5]);
  assert.ok(Math.abs(centre[0]) < 1e-9 && Math.abs(centre[1]) < 1e-9);
  const left = panoramaPixelToGalacticDegrees([width / 2 - 1.5, height / 2 - 0.5]);
  assert.ok(Math.abs(left[0] - 360 / width) < 1e-9);
  const right = panoramaPixelToGalacticDegrees([width / 2 + 0.5, height / 2 - 0.5]);
  assert.ok(Math.abs(right[0] - (360 - 360 / width)) < 1e-9);
  // Top row is the north galactic pole side.
  assert.ok(panoramaPixelToGalacticDegrees([0, 0])[1] > 89.9);
  assert.ok(panoramaPixelToGalacticDegrees([0, height - 1])[1] < -89.9);
  // Round trip.
  for (const anchor of ESO_PANORAMA_ANCHORS) {
    const pixel = galacticDegreesToPanoramaPixel(anchor.galacticDegrees);
    const back = panoramaPixelToGalacticDegrees(pixel);
    assert.ok(Math.abs(back[0] - anchor.galacticDegrees[0]) < 1e-9);
    assert.ok(Math.abs(back[1] - anchor.galacticDegrees[1]) < 1e-9);
  }
});

test("the anchors need a single small rotation, not a mirror, to register", () => {
  const fit = ESO_PANORAMA_REGISTRATION;
  assert.equal(fit.anchorCount, 5);
  // Uncorrected, every anchor misses by a few degrees: the mosaic frame is
  // consistently off, which a mirrored convention could not produce.
  for (const [name, residual] of Object.entries(fit.uncorrectedResidualsDegrees)) {
    assert.ok(residual > 2 && residual < 4, `${name} uncorrected ${residual}`);
  }
  // A rigid rotation of about 3.8 degrees registers all five to well under
  // the anchor-centroid precision.
  assert.ok(Math.abs(fit.angleDegrees - 3.83) < 0.15, `angle ${fit.angleDegrees}`);
  assert.ok(fit.maximumResidualDegrees < 0.3, `residuals ${JSON.stringify(fit.residualsDegrees)}`);
  // A proper rotation.
  const m = fit.matrix;
  for (let row = 0; row < 3; row += 1) {
    assert.ok(Math.abs(Math.hypot(m[row * 3], m[row * 3 + 1], m[row * 3 + 2]) - 1) < 1e-12);
  }
  const determinant = m[0] * (m[4] * m[8] - m[5] * m[7]) -
    m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  assert.ok(Math.abs(determinant - 1) < 1e-12);
});

test("mirroring the longitude convention destroys the fit", () => {
  const mirrored = ESO_PANORAMA_ANCHORS.map((anchor) => ({
    ...anchor,
    pixel: [ESO_PANORAMA.size[0] - 1 - anchor.pixel[0], anchor.pixel[1]],
  }));
  const fit = fitPanoramaFrameRotation(mirrored);
  assert.ok(fit.maximumResidualDegrees > 20, `mirrored residual ${fit.maximumResidualDegrees}`);
});

test("the correction maps catalogue positions onto the measured pixels", () => {
  for (const anchor of ESO_PANORAMA_ANCHORS) {
    const image = transformDirection(
      ESO_PANORAMA_REGISTRATION.matrix,
      directionFromDegrees(...anchor.galacticDegrees),
    );
    const longitude = (Math.atan2(image[1], image[0]) * 180 / Math.PI + 360) % 360;
    const latitude = Math.asin(image[2]) * 180 / Math.PI;
    const pixel = galacticDegreesToPanoramaPixel([longitude, latitude]);
    // 0.3 degrees is 5 pixels at 6000 columns.
    assert.ok(Math.abs(pixel[0] - anchor.pixel[0]) < 6, `${anchor.name} x ${pixel[0]}`);
    assert.ok(Math.abs(pixel[1] - anchor.pixel[1]) < 6, `${anchor.name} y ${pixel[1]}`);
  }
});
