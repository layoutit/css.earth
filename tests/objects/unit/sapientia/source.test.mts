import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 16284,
  "shapeSha256": "420f22693cd4653eaae4ff9229b13793ead35898a874f4ab8738a779e91bc0c4",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    12.46698,
    8.141599,
    49.83691
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 572150.5235493955,
  "diameterKm": 103.0,
  "uncertaintyKm": 7.0,
  "lambda": 264.0,
  "beta": -2.0,
  "periodHours": 14.93046,
  "name": "Sapientia",
  "modelVersion": "2023-10-03"
};

test("Sapientia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("sapientia", independentExpected));
