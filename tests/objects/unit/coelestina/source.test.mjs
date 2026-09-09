import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1218,
  "shapeSha256": "427b7e385d125ecccedc0cbf7129a960bf32bcb5f793e1fb0c8464d464d6a784",
  "vertices": 1000,
  "faces": 1996,
  "firstVertex": [
    -0.147239,
    -0.040674,
    0.602354
  ],
  "firstFace": [
    2,
    3,
    4
  ],
  "signedVolume": 0.9999998600536072,
  "diameterKm": 39.51,
  "uncertaintyKm": 0.69,
  "lambda": 230.0,
  "beta": 30.0,
  "periodHours": 29.1753,
  "name": "Coelestina",
  "modelVersion": "2016-01-04"
};

test("Coelestina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("coelestina", independentExpected));
