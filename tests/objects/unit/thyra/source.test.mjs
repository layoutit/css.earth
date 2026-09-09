import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 154,
  "shapeSha256": "d3e017daf4e6a4b91d1854af583a2e128397c945dc62d2c384b8420bf8094a2f",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    14.139903,
    3.882207,
    44.502844
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 407720.0509201346,
  "diameterKm": 92.0,
  "uncertaintyKm": 2.0,
  "lambda": 35.0,
  "beta": 33.0,
  "periodHours": 7.23996,
  "name": "Thyra",
  "modelVersion": "2009-02-26"
};

test("Thyra preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("thyra", independentExpected));
