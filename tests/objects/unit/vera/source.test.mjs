import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1212,
  "shapeSha256": "2d0eb67cc470d629766b5c5f396820808162acbb1bd994548ffc9b38329268dc",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.126334,
    0.308306,
    0.496626
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999860387033,
  "diameterKm": 72.88,
  "uncertaintyKm": 0.91,
  "lambda": 96.0,
  "beta": -50.0,
  "periodHours": 14.35651,
  "name": "Vera",
  "modelVersion": "2016-01-04"
};

test("Vera preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("vera", independentExpected));
