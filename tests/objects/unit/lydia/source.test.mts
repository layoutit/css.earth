import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 152,
  "shapeSha256": "ce4560318a58f130ddd60a01038a7fdb3bcc30554d3507ade899cda740975004",
  "vertices": 1597,
  "faces": 3190,
  "firstVertex": [
    8.329645,
    -0.477627,
    36.725626
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 394568.75938298897,
  "diameterKm": 91.0,
  "uncertaintyKm": 1.0,
  "lambda": 149.0,
  "beta": -55.0,
  "periodHours": 10.9258,
  "name": "Lydia",
  "modelVersion": "2009-02-26"
};

test("Lydia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lydia", independentExpected));
