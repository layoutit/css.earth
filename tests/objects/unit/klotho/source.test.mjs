import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 321,
  "shapeSha256": "11db1e440c1fdbe9f28f96d0750381d4238645ba651903e586b56fb08c1c7ccd",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    2.699555,
    4.363997,
    42.891431
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 321555.1345665133,
  "diameterKm": 85.0,
  "uncertaintyKm": 9.0,
  "lambda": 359.0,
  "beta": 30.0,
  "periodHours": 35.251,
  "name": "Klotho",
  "modelVersion": "2011-04-21"
};

test("Klotho preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("klotho", independentExpected));
