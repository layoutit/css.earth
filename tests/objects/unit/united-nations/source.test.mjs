import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "United Nations",
  "modelId": 1154,
  "modelVersion": "2016-01-04",
  "shapeSha256": "9f8df63e5658a5f6657a6f9abaa9ca55ed8adbc4712304e6d313c23e28f9167a",
  "vertices": 563,
  "faces": 1122,
  "firstVertex": [
    0.11161,
    0.126591,
    0.406232
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999941836871,
  "diameterKm": 11.0,
  "uncertaintyKm": 0.295,
  "lambda": 13.0,
  "beta": -84.0,
  "periodHours": 3.26191
};

test("United Nations preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("united-nations", independentExpected));
