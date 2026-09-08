import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Maja",
  "modelId": 1233,
  "modelVersion": "2016-01-04",
  "shapeSha256": "587900c8fa238632e992111688ea6ab5b2e373f730f7acd0a13030589275c327",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.247876,
    -0.007918,
    0.380875
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.00000003575545,
  "diameterKm": 71.79,
  "uncertaintyKm": 0.92,
  "lambda": 49.0,
  "beta": -70.0,
  "periodHours": 9.7357
};

test("Maja preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("maja", independentExpected));
