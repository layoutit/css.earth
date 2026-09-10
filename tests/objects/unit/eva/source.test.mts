import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1021,
  "shapeSha256": "c9f55273db249c8adb0a08784259e0967e93a8f1876f48dd6afe7d7f634ad87d",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.225095,
    0.075861,
    0.573307
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000395765907,
  "diameterKm": 97.7,
  "uncertaintyKm": 1.56,
  "lambda": 54.0,
  "beta": -10.0,
  "periodHours": 13.6638,
  "name": "Eva",
  "modelVersion": "2016-01-04"
};

test("Eva preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eva", independentExpected));
