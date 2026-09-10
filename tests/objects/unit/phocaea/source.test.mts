import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 697,
  "shapeSha256": "508b7c0d7855f6aa60a8aa63d9ed3f2f7226718ca88d3eb72b0427228b69804e",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.141577,
    0.186039,
    0.556413
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999108089296,
  "diameterKm": 83.21,
  "uncertaintyKm": 0.96,
  "lambda": 347.0,
  "beta": 10.0,
  "periodHours": 9.935397,
  "name": "Phocaea",
  "modelVersion": "2013-02-20"
};

test("Phocaea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("phocaea", independentExpected));
