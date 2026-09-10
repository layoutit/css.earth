import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Reinmuthia",
  "modelId": 678,
  "modelVersion": "2013-02-11",
  "shapeSha256": "50276c546e6204efae333bb272a73d20881e5c435aa9d864ea4e348138a545bf",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.498013,
    0.019567,
    0.374181
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999156515121,
  "diameterKm": 24.38,
  "uncertaintyKm": 0.48,
  "lambda": 153.0,
  "beta": 78.0,
  "periodHours": 4.007347
};

test("Reinmuthia preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("reinmuthia", independentExpected));
