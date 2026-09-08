import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Massalia",
  "modelId": 16321,
  "modelVersion": "2026-04-30 15:07:16",
  "shapeSha256": "524c84346cc770f9974d2493b0b2d9a2c06ca58f0a1701e2e159ec20d01e1045",
  "vertices": 1922,
  "faces": 3840,
  "firstVertex": [
    0.0687205935,
    0.24445146,
    1.7466883
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 35.13365487698239,
  "diameterKm": 147.0,
  "uncertaintyKm": 2.0,
  "lambda": 304.1,
  "beta": 63.7,
  "periodHours": 8.0975859
};

test("Massalia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("massalia", independentExpected));
