import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Transvaalia",
  "modelId": 3722,
  "modelVersion": "2019-05-07",
  "shapeSha256": "e9273c2a279f53c89a3d5df3735e5c836f2e4edb88bef6cee4dce35b2874fd1e",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.061493,
    -0.052153,
    0.66086
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998689653705,
  "diameterKm": 25.458,
  "uncertaintyKm": 0.591,
  "beta": 62.0,
  "periodHours": 11.82586,
  "lambda": 125.0
};

test("Transvaalia preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("transvaalia", independentExpected));
