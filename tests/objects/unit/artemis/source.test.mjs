import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5939,
  "shapeSha256": "94fc92d360a1f3a2717868f1d57a9198a413398e84683329b60707f2f5a10b9b",
  "vertices": 1021,
  "faces": 2038,
  "firstVertex": [
    0.042707,
    0.189922,
    0.452063
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999472806751,
  "diameterKm": 123.53,
  "uncertaintyKm": 1.5,
  "lambda": 47.0,
  "beta": 24.0,
  "periodHours": 37.118,
  "name": "Artemis",
  "modelVersion": "2022-02-14"
};

test("Artemis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("artemis", independentExpected));
