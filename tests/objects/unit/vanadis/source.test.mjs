import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6039,
  "shapeSha256": "616f9e9caf14dd14bfb662642e787d1d22478f53727d8f3eef207287cdfd109b",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.13068,
    0.052512,
    0.659811
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999145117763,
  "diameterKm": 90.13,
  "uncertaintyKm": 1.22,
  "lambda": 64.0,
  "beta": 12.0,
  "periodHours": 10.5606,
  "name": "Vanadis",
  "modelVersion": "2022-02-14"
};

test("Vanadis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("vanadis", independentExpected));
