import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4273,
  "shapeSha256": "b6c5a04a7f568ec3a11326f659040cb0fedf1e06fa0e426e7776b5c4ba35f8a2",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.022529,
    -0.245683,
    0.572431
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000002162420796,
  "diameterKm": 50.799,
  "uncertaintyKm": 1.181,
  "lambda": 328.0,
  "beta": 28.0,
  "periodHours": 20.6338,
  "name": "Agenor",
  "modelVersion": "2019-05-07"
};

test("Agenor preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("agenor", independentExpected));
