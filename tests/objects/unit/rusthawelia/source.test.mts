import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Rusthawelia",
  "modelId": 3188,
  "modelVersion": "2019-05-07",
  "shapeSha256": "890c5ddc5bf62360d5e4369a8f35b30f4868233baf3da1eb4b8622c9ccb8af6a",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.117072,
    -0.062808,
    0.620253
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001637401592,
  "diameterKm": 67.986,
  "uncertaintyKm": 1.091,
  "lambda": 13.0,
  "beta": 59.0,
  "periodHours": 11.00463
};

test("Rusthawelia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("rusthawelia", independentExpected));
