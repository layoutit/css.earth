import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4383,
  "shapeSha256": "3c9b6ec13ef63607aaa3b4b2419bcf7b94232652d260b9b4f1a8e0eb5b49350a",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    0.018887,
    0.029107,
    0.581514
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999016560848,
  "diameterKm": 120.62,
  "uncertaintyKm": 1.53,
  "lambda": 291.0,
  "beta": 12.0,
  "periodHours": 21.0401,
  "name": "Hestia",
  "modelVersion": "2019-07-19"
};

test("Hestia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hestia", independentExpected));
