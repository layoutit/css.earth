import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Parysatis",
  "modelId": 5820,
  "modelVersion": "2019-10-23",
  "shapeSha256": "5d01fc5141682daead93573aef676e56dfd5cdee4f9608b15a0125d7887bf9bf",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.092275,
    0.150323,
    0.651266
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001788221407,
  "diameterKm": 44.749,
  "uncertaintyKm": 0.37,
  "beta": -47.0,
  "periodHours": 5.93333,
  "lambda": 263.0
};

test("Parysatis preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("parysatis", independentExpected));
