import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 548,
  "shapeSha256": "f448756b26da376283009caf5049d40dc1054ed2370c003ee80fe2cf831ecf49",
  "vertices": 1002,
  "faces": 2000,
  "firstVertex": [
    0.074764,
    0.054831,
    0.365783
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998442290257,
  "diameterKm": 37.89,
  "uncertaintyKm": 0.65,
  "lambda": 141.0,
  "beta": -11.0,
  "periodHours": 6.58167,
  "name": "Ambrosia",
  "modelVersion": "2013-02-11"
};

test("Ambrosia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ambrosia", independentExpected));
