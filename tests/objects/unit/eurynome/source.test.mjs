import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 496,
  "shapeSha256": "36b740ae2cab2874d468ab7340d77f5783abe3782285b88fe453547f82205661",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.062362,
    0.115859,
    0.629165
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000105082278,
  "diameterKm": 74.75,
  "uncertaintyKm": 0.94,
  "lambda": 54.0,
  "beta": 24.0,
  "periodHours": 5.977723,
  "name": "Eurynome",
  "modelVersion": "2013-02-11"
};

test("Eurynome preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eurynome", independentExpected));
