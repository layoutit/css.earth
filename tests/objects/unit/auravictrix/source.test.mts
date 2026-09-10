import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Auravictrix",
  "modelId": 1654,
  "modelVersion": "2016-01-12",
  "shapeSha256": "477d88385d0212d76042c2ce706f5ea0b0adafc70b55e44bb0c73291e1a2256f",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.321476,
    0.025834,
    0.520229
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001502158486,
  "diameterKm": 16.421,
  "uncertaintyKm": 0.362,
  "beta": 47.0,
  "periodHours": 6.07488,
  "lambda": 249.0
};

test("Auravictrix preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("auravictrix", independentExpected));
