import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "China",
  "modelId": 1119,
  "modelVersion": "2016-01-04",
  "shapeSha256": "3e128e4dda6c3ed434637ef727dc7e325b813107470d8c5a0964b7cfb6fe7d44",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    -0.255045,
    0.063712,
    0.664266
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999694504531,
  "diameterKm": 26.084,
  "uncertaintyKm": 0.199,
  "lambda": 305.0,
  "beta": -49.0,
  "periodHours": 5.36863
};

test("China preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("china", independentExpected));
