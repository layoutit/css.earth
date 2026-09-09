import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 686,
  "shapeSha256": "afffd52ce5fa7564a907f0a7aa6b0dd4c63842ac4dfb0ab6182b57e9968335be",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.042738,
    0.144966,
    0.430075
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000035700685,
  "diameterKm": 26.54,
  "uncertaintyKm": 0.58,
  "lambda": 109.0,
  "beta": -53.0,
  "periodHours": 11.69033,
  "name": "Anna",
  "modelVersion": "2013-02-11"
};

test("Anna preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("anna", independentExpected));
