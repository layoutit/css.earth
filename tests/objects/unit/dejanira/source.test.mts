import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 591,
  "shapeSha256": "9c67749dd7cb5a594927246b2f884cae7d17989b67e9f1c028793518705fdb65",
  "vertices": 560,
  "faces": 1116,
  "firstVertex": [
    0.212916,
    0.279424,
    0.520272
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000151881592,
  "diameterKm": 22.47,
  "uncertaintyKm": 1.24,
  "lambda": 319.0,
  "beta": -64.0,
  "periodHours": 15.8287,
  "name": "Dejanira",
  "modelVersion": "2013-02-19"
};

test("Dejanira preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("dejanira", independentExpected));
