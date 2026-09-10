import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3896,
  "shapeSha256": "8bccce94993f84b19d6d0944ae3aff994cf00cd0a75b4b8599bad18b7d706855",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.218264,
    0.089644,
    0.543641
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998181039004,
  "diameterKm": 37.63,
  "uncertaintyKm": 1.307,
  "lambda": 117.0,
  "beta": -3.0,
  "periodHours": 50.2193,
  "name": "Demodokus",
  "modelVersion": "2019-05-07"
};

test("Demodokus preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("demodokus", independentExpected));
