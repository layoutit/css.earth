import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Tartaglia",
  "modelId": 15683,
  "modelVersion": "2022-11-29",
  "shapeSha256": "ee1a402a083d8aa2ce1aad16d6efd9ad71641e82cf788c45c0b0c9b8fb171514",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.327785,
    0.076625,
    0.471665
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000137496902,
  "diameterKm": 13.584,
  "uncertaintyKm": 0.067,
  "lambda": 284.0,
  "beta": 88.0,
  "periodHours": 7.2234
};

test("Tartaglia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("tartaglia", independentExpected));
