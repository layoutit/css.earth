import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Veritas",
  "modelId": 833,
  "modelVersion": "2016-01-04",
  "shapeSha256": "4b038d538898e8c11f692d3f034461d6cd06c41ece0c30f1d0b72d7ee4bca39a",
  "vertices": 1019,
  "faces": 2034,
  "firstVertex": [
    0.208927,
    -0.025453,
    0.573633
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001853467448,
  "diameterKm": 118.803,
  "uncertaintyKm": 1.83,
  "beta": 34.0,
  "periodHours": 7.92811,
  "lambda": 56.0
};

test("Veritas preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("veritas", independentExpected));
