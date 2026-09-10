import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Literal anchors checked against the original published mesh and physical-size data.
const independentExpected = {
  "name": "Petrina",
  "modelId": 1152,
  "modelVersion": "2016-01-04",
  "shapeSha256": "1189e6d6480532a0b3bd0dc2b18f9663f4e0154145640f0638bd5e6348033632",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.15386,
    0.25639,
    0.466694
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999888030343,
  "diameterKm": 44.2,
  "uncertaintyKm": 1.0,
  "lambda": 281.0,
  "beta": 61.0,
  "periodHours": 11.79214
};

test("Petrina preserves original shape, independently measured scale and qualified retained output", () => assertCalibratedAsteroidSource("petrina", independentExpected));
