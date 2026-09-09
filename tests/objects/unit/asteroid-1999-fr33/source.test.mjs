import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "1999 FR33",
  "modelId": 15145,
  "modelVersion": "2022-12-01",
  "shapeSha256": "4b80f749069df27aeffc6c40e144a9b7a75ee36025e0845e5fe2a313eb0bc8c5",
  "vertices": 570,
  "faces": 1136,
  "firstVertex": [
    0.460809,
    -0.278559,
    0.443818
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998177032914,
  "diameterKm": 5.754,
  "uncertaintyKm": 0.174,
  "lambda": 145.0,
  "beta": -85.0,
  "periodHours": 3.38833
};

test("1999 FR33 preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("asteroid-1999-fr33", independentExpected));
