import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 16309,
  "shapeSha256": "eb435f1eed2b7bdab2a018e10e761e55375947842b4627375cab9e9380a55e78",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    -0.139785,
    0.358036,
    0.465664
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001840238042,
  "diameterKm": 148.02,
  "uncertaintyKm": 2.56,
  "lambda": 95.0,
  "beta": -89.0,
  "periodHours": 20.70802,
  "name": "Pales",
  "modelVersion": "2025-07-08"
};

test("Pales preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("pales", independentExpected));
