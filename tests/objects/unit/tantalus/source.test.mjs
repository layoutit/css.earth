import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6205,
  "shapeSha256": "deeba7099d07c93d2da587bec6974398634beb3ab21b95ab0a51f56aa4463d59",
  "vertices": 1000,
  "faces": 1996,
  "firstVertex": [
    -0.001055,
    0.001013,
    0.681091
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.5962562691861362,
  "diameterKm": 1.45,
  "uncertaintyKm": 0.2,
  "lambda": 36.0,
  "beta": 30.0,
  "periodHours": 2.39006,
  "name": "Tantalus",
  "modelVersion": "2022-07-13"
};

test("Tantalus preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("tantalus", independentExpected));
