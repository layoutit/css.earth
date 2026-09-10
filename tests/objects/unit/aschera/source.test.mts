import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1435,
  "shapeSha256": "425c5eaa458c41fc0ecd53191819cd902e7f242a38b77aa0d4860b788d403674",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.009546,
    0.103936,
    0.714301
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000046371027,
  "diameterKm": 26.07,
  "uncertaintyKm": 0.34,
  "lambda": 123.0,
  "beta": -37.0,
  "periodHours": 6.8337,
  "name": "Aschera",
  "modelVersion": "2016-01-12"
};

test("Aschera preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("aschera", independentExpected));
