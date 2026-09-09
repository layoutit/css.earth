import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1858,
  "shapeSha256": "667be44f59441cbb117e91d5153cc6b6547810348ff58a7dc946a4d1dad4bf21",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -2.574271,
    6.620751,
    42.922828
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 782233.6727895029,
  "diameterKm": 114.0,
  "uncertaintyKm": 8.0,
  "lambda": 343.0,
  "beta": -74.0,
  "periodHours": 12.31241,
  "name": "Thalia",
  "modelVersion": "2017-09-21"
};

test("Thalia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("thalia", independentExpected));
