import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 702,
  "shapeSha256": "a32b67db173623ddbff30c471278e92fb0925f0d0a1b787b0f9a7ed23c24ce96",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.258809,
    0.227388,
    0.462485
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000862415732,
  "diameterKm": 79.2,
  "uncertaintyKm": 0.97,
  "lambda": 5.0,
  "beta": -53.0,
  "periodHours": 15.7097,
  "name": "Silesia",
  "modelVersion": "2013-02-11"
};

test("Silesia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("silesia", independentExpected));
