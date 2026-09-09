import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 994,
  "shapeSha256": "76e84bb363bc61fff99cee400395d53d29cbb4b11ef0012f4513dfbb689b06cd",
  "vertices": 528,
  "faces": 1052,
  "firstVertex": [
    0.228375,
    0.128282,
    0.499255
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.999999835930124,
  "diameterKm": 71.06,
  "uncertaintyKm": 0.94,
  "lambda": 286.0,
  "beta": -50.0,
  "periodHours": 31.4626,
  "name": "Iphigenia",
  "modelVersion": "2016-01-04"
};

test("Iphigenia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("iphigenia", independentExpected));
