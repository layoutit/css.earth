import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4787,
  "shapeSha256": "3108ee1d5da9b4004ac87f550e1a5f5561e02214612a4237757764eed1830f1f",
  "vertices": 564,
  "faces": 1124,
  "firstVertex": [
    -0.006628,
    0.262325,
    0.708747
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999544970697,
  "diameterKm": 51.03,
  "uncertaintyKm": 0.6,
  "lambda": 188.0,
  "beta": 14.0,
  "periodHours": 19.487,
  "name": "Kallisto",
  "modelVersion": "2019-10-23"
};

test("Kallisto preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("kallisto", independentExpected));
