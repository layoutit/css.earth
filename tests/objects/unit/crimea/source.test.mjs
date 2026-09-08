import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Crimea",
  "modelId": 403,
  "modelVersion": "2011-04-21",
  "shapeSha256": "8facba4b82f8c0b8a07506e24100ae6c721bb21661d113b7df51b6f9fd6d0117",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.567601,
    0.094509,
    0.330474
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999865197972,
  "diameterKm": 29.179,
  "uncertaintyKm": 0.155,
  "lambda": 12.0,
  "beta": -73.0,
  "periodHours": 9.78693
};

test("Crimea preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("crimea", independentExpected));
