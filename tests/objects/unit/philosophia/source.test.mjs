import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1873,
  "shapeSha256": "e21f6191a0e78785b81cf603e3e0f86281aca58b705fc1cadfebb5a043afef6f",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    16.739489,
    20.274099,
    50.812326
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 641431.0428382676,
  "diameterKm": 101.0,
  "uncertaintyKm": 5.0,
  "lambda": 95.0,
  "beta": 19.0,
  "periodHours": 26.4614,
  "name": "Philosophia",
  "modelVersion": "2018-03-22"
};

test("Philosophia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("philosophia", independentExpected));
