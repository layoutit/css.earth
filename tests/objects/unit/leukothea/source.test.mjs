import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Leukothea",
  "modelId": 867,
  "modelVersion": "2016-01-04",
  "shapeSha256": "c2abe03b883ffd4ac42bee1f6c015a6badadb1d0cec330476c2c15828a9ff593",
  "vertices": 1010,
  "faces": 2016,
  "firstVertex": [
    -0.137052,
    0.209158,
    0.5256
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998494318009,
  "diameterKm": 111.48,
  "uncertaintyKm": 1.85,
  "lambda": 196.0,
  "beta": 0.0,
  "periodHours": 31.901
};

test("Leukothea preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("leukothea", independentExpected));
