import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Tulipa",
  "modelId": 1779,
  "modelVersion": "2017-05-11",
  "shapeSha256": "e9ca02b70409de00bfcf17b56680e573a8f3840e5e4a0a1446ae83c842206c55",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.048745,
    -0.042918,
    0.642321
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999854651239,
  "diameterKm": 27.875,
  "uncertaintyKm": 0.362,
  "beta": 40.0,
  "periodHours": 2.787153,
  "lambda": 143.0
};

test("Tulipa preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("tulipa", independentExpected));
