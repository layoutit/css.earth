import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Kressmannia",
  "modelId": 382,
  "modelVersion": "2011-04-21",
  "shapeSha256": "401f6b6b3ac21253ebf4d13a34e2ed951e3f7212652bd0f84fd0099989e2bec6",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.286975,
    -0.022171,
    0.548467
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999997816670111,
  "diameterKm": 15.429,
  "uncertaintyKm": 0.325,
  "beta": 37.0,
  "periodHours": 4.460963,
  "lambda": 345.0
};

test("Kressmannia preserves original shape, measured size and qualified retained output", () => assertCalibratedAsteroidSource("kressmannia", independentExpected));
