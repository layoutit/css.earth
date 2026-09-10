import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 16312,
  "shapeSha256": "27a2a816bb4696dec5bc7a31dd1bc50cf6018abaaca213311ba81a0fdb33a4b9",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -3.597496,
    4.693375,
    16.29401
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 26521.847920031152,
  "diameterKm": 37.0,
  "uncertaintyKm": 2.0,
  "lambda": 45.0,
  "beta": 85.0,
  "periodHours": 27.9077,
  "name": "Oenone",
  "modelVersion": "2025-07-15"
};

test("Oenone preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("oenone", independentExpected));
