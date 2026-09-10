import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1743,
  "shapeSha256": "83fdebb219ce6f345437cd87e7009a4f15a93682e9e825ebe135f7579ba3c9d4",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.222672,
    0.109761,
    0.530011
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.00000002482977,
  "diameterKm": 107.74,
  "uncertaintyKm": 1.51,
  "lambda": 289.0,
  "beta": -23.0,
  "periodHours": 10.44212,
  "name": "Eos",
  "modelVersion": "2017-03-31"
};

test("Eos preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eos", independentExpected));
