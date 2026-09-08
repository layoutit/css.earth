import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Gyptis",
  "modelId": 5394,
  "modelVersion": "2019-10-23",
  "shapeSha256": "94376fbdeea8797ce676895cb19d9fe4c3853b0672024314875c10dcb77b7fc1",
  "vertices": 548,
  "faces": 1092,
  "firstVertex": [
    0.349919,
    -0.151761,
    0.513012
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000605846517,
  "diameterKm": 166.03,
  "uncertaintyKm": 6.66,
  "lambda": 58.0,
  "beta": 15.0,
  "periodHours": 6.21516
};

test("Gyptis preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("gyptis", independentExpected));
