import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Hidalgo",
  "modelId": 1057,
  "modelVersion": "2016-01-04",
  "shapeSha256": "8dcf880fd622ce2d704c95bae87e662a63ae63c5a92d4649ff232341222e4f00",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.106397,
    0.554049,
    0.343282
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999887372527,
  "diameterKm": 61.4,
  "uncertaintyKm": 12.7,
  "beta": 16.0,
  "periodHours": 10.05822,
  "lambda": 277.0
};

test("Hidalgo preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("hidalgo", independentExpected));
