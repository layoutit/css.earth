import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5958,
  "shapeSha256": "78ec4654953bce428c657665cc21c70e933184fdeb4952e7243df70d97be698e",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    -0.079155,
    0.076014,
    0.525817
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999834036638,
  "diameterKm": 43.94,
  "uncertaintyKm": 0.49,
  "lambda": 120.0,
  "beta": 46.0,
  "periodHours": 5.36708,
  "name": "Velleda",
  "modelVersion": "2022-02-14"
};

test("Velleda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("velleda", independentExpected));
