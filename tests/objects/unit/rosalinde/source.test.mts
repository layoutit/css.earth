import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Rosalinde",
  "modelId": 561,
  "modelVersion": "2013-02-11",
  "shapeSha256": "b5ee9fab82357bf57d6dc810c5a2e0068f9bcd15ec20cc87c99de9da55b24425",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.09062,
    0.138323,
    0.463539
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001431692804,
  "diameterKm": 19.618,
  "uncertaintyKm": 0.057,
  "beta": 70.0,
  "periodHours": 16.68678,
  "lambda": 276.0
};

test("Rosalinde preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("rosalinde", independentExpected));
