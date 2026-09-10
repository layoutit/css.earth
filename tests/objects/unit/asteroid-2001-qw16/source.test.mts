import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "2001 QW16",
  "modelId": 15015,
  "modelVersion": "2022-11-29",
  "shapeSha256": "e41e4dae7371422f0d9aa7c771b916832311f7b74ca5cc3995dc9f1317433f33",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.155903,
    0.223944,
    0.544964
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998790833026,
  "diameterKm": 10.403,
  "uncertaintyKm": 0.259,
  "lambda": 209.0,
  "beta": 74.0,
  "periodHours": 7.3402
};

test("2001 QW16 preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("asteroid-2001-qw16", independentExpected));
