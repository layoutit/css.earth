import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Ducrosa",
  "modelId": 352,
  "modelVersion": "2011-04-21",
  "shapeSha256": "7ba02ff5a7a468e10461083f8b0fbc9bb54d6ac6cfc6c1ac14f7acf2445f24fa",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.170146,
    -0.012232,
    0.586875
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997290794677,
  "diameterKm": 34.1,
  "uncertaintyKm": 0.5,
  "lambda": 328.0,
  "beta": 56.0,
  "periodHours": 6.86788
};

test("Ducrosa preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("ducrosa", independentExpected));
