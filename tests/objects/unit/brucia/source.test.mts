import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Brucia",
  "modelId": 10666,
  "modelVersion": "2022-11-29",
  "shapeSha256": "5111fbd781aebf114af225f23fe0ce94fa6be333491e0d95299bc5105b0beddf",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.049412,
    0.109722,
    0.58499
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997259521002,
  "diameterKm": 37.29,
  "uncertaintyKm": 0.76,
  "lambda": 64.0,
  "beta": -13.0,
  "periodHours": 9.4596
};

test("Brucia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("brucia", independentExpected));
