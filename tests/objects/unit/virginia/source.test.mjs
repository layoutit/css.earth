import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Virginia",
  "modelId": 12738,
  "modelVersion": "2024-04-09",
  "shapeSha256": "8b1dc50c7f205bb4935eaab846f570620cca1443dfe383c2b6706ecc7bcf1a42",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.05284,
    0.089695,
    0.537847
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000995128715,
  "diameterKm": 84.37,
  "uncertaintyKm": 0.82,
  "lambda": 295.0,
  "beta": 47.0,
  "periodHours": 14.31233
};

test("Virginia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("virginia", independentExpected));
