import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1850,
  "shapeSha256": "a57d764a9b9b83bb318bd9e36a6048f50f05326584a343092351d81c25a85489",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    14.532314,
    -6.878471,
    44.594108
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 698720.0358450098,
  "diameterKm": 110.0,
  "uncertaintyKm": 5.0,
  "lambda": 99.0,
  "beta": 10.0,
  "periodHours": 5.05441,
  "name": "Bettina",
  "modelVersion": "2017-09-21"
};

test("Bettina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("bettina", independentExpected));
