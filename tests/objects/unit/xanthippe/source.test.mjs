import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4643,
  "shapeSha256": "422ea5874855df00a405ee696a57cf05421b5b30f4118f016eed543675e3855a",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.171236,
    0.162699,
    0.530404
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999164314383,
  "diameterKm": 115.49,
  "uncertaintyKm": 1.74,
  "lambda": 197.0,
  "beta": 9.0,
  "periodHours": 22.1157,
  "name": "Xanthippe",
  "modelVersion": "2019-10-23"
};

test("Xanthippe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("xanthippe", independentExpected));
