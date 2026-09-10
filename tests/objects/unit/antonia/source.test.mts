import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 637,
  "shapeSha256": "536fd7168d0691b0111d6362045134cacaa1f1bf92f9f767e949357d5fe04adf",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.363739,
    0.20017,
    0.459702
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000079085254,
  "diameterKm": 23.89,
  "uncertaintyKm": 0.49,
  "lambda": 293.0,
  "beta": -90.0,
  "periodHours": 3.854798,
  "name": "Antonia",
  "modelVersion": "2013-02-11"
};

test("Antonia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("antonia", independentExpected));
