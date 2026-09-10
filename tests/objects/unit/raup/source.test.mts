import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Raup",
  "modelId": 5835,
  "modelVersion": "2019-10-23",
  "shapeSha256": "ffae22baf0155a59ff90c8363569c60c3261fce268cd2871126416261159367b",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.293362,
    0.279159,
    0.490325
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997129937245,
  "diameterKm": 4.839,
  "uncertaintyKm": 0.167,
  "lambda": 269.0,
  "beta": 87.0,
  "periodHours": 46.22
};

test("Raup preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("raup", independentExpected));
