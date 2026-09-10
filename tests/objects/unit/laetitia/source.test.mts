import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1835,
  "shapeSha256": "399e10e28457f6fe4aa93cb322ddd5d262681eeb9638ac092e55bbf138b5f747",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    8.470469,
    -5.739412,
    58.936905
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 2299415.8098790417,
  "diameterKm": 164.0,
  "uncertaintyKm": 3.0,
  "lambda": 323.0,
  "beta": 33.0,
  "periodHours": 5.138238,
  "name": "Laetitia",
  "modelVersion": "2017-06-06"
};

test("Laetitia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("laetitia", independentExpected));
