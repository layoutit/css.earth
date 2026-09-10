import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4859,
  "shapeSha256": "02061f1763d9d4005b8cf226e8abace734b5796a9ee5d651bf1e767ce8ab04f3",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.214628,
    0.05516,
    0.396533
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998728846586,
  "diameterKm": 107.57,
  "uncertaintyKm": 1.5,
  "lambda": 184.0,
  "beta": 54.0,
  "periodHours": 7.3561,
  "name": "Henrietta",
  "modelVersion": "2019-10-23"
};

test("Henrietta preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("henrietta", independentExpected));
