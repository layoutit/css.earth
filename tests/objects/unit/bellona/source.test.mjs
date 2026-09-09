import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1839,
  "shapeSha256": "ff1d83697f66dfc11511783c70c93f8cc5c44e88373e91d68b5103f19bfa5644",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    3.495762,
    -2.827641,
    68.708377
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1238792.6848966654,
  "diameterKm": 133.0,
  "uncertaintyKm": 7.0,
  "lambda": 98.0,
  "beta": -10.0,
  "periodHours": 15.70785,
  "name": "Bellona",
  "modelVersion": "2017-09-21"
};

test("Bellona preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("bellona", independentExpected));
