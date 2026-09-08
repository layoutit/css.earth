import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Juewa",
  "modelId": 5985,
  "modelVersion": "2022-02-14",
  "shapeSha256": "299db30077ce9e5c022971c38780e16113ad0716ce7de0ce6ffd9288a55acb0c",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.082553,
    0.169146,
    0.613837
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999619996515,
  "diameterKm": 166.69,
  "uncertaintyKm": 2.77,
  "lambda": 271.0,
  "beta": -25.0,
  "periodHours": 20.9844
};

test("Juewa preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("juewa", independentExpected));
