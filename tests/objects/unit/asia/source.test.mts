import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5668,
  "shapeSha256": "784a802ce9b6fe162194a958f5f66d20f06b591d3b50733fc93aa4e7bc50a453",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.328608,
    0.094218,
    0.445501
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999884659112,
  "diameterKm": 61.63,
  "uncertaintyKm": 0.65,
  "lambda": 117.0,
  "beta": 42.0,
  "periodHours": 15.8504,
  "name": "Asia",
  "modelVersion": "2019-10-23"
};

test("Asia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("asia", independentExpected));
