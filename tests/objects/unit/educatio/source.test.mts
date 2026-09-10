import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Educatio",
  "modelId": 9541,
  "modelVersion": "2022-11-29",
  "shapeSha256": "1aa7bf28a3514adb552d13c7061f7734b81e281b2d8e5a2f97958256ea2700f0",
  "vertices": 568,
  "faces": 1132,
  "firstVertex": [
    0.524751,
    0.374259,
    0.342497
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000139560106,
  "diameterKm": 6.586,
  "uncertaintyKm": 0.128,
  "lambda": 168.0,
  "beta": 56.0,
  "periodHours": 231.2
};

test("Educatio preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("educatio", independentExpected));
