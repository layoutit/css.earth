import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "IAU",
  "modelId": 12740,
  "modelVersion": "2022-11-29",
  "shapeSha256": "2ca32a686baf5562f447d268d0f7e7debeb9244b60871fb49dd6c70eb085aca7",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.877465,
    0.779292,
    0.324315
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.99999997769853,
  "diameterKm": 4.242,
  "uncertaintyKm": 0.917,
  "lambda": 31.0,
  "beta": -38.0,
  "periodHours": 4.47862
};

test("IAU preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("iau", independentExpected));
