import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Virtanen",
  "modelId": 1175,
  "modelVersion": "2016-01-04",
  "shapeSha256": "1f1b9833f39a6e6c348f2023554a2defac86b47531a8c3a0ac64b4b0bf562983",
  "vertices": 1012,
  "faces": 2020,
  "firstVertex": [
    -0.296629,
    0.105226,
    0.492191
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000282690485,
  "diameterKm": 9.263,
  "uncertaintyKm": 0.098,
  "lambda": 307.0,
  "beta": 58.0,
  "periodHours": 30.5005
};

test("Virtanen preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("virtanen", independentExpected));
