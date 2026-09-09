import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 323,
  "shapeSha256": "6d8297de717271593165d8e34c141a3d1565e851957dd91ddaea2ce0f15945c3",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.233668,
    0.173417,
    0.453842
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999250627601,
  "diameterKm": 58.79,
  "uncertaintyKm": 0.62,
  "lambda": 339.0,
  "beta": -67.0,
  "periodHours": 11.46514,
  "name": "Althaea",
  "modelVersion": "2011-04-21"
};

test("Althaea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("althaea", independentExpected));
