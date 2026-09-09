import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1841,
  "shapeSha256": "69468466831b229d880e8d0f58a4046ae973653da5d1155733fbbf8185ac9611",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -14.300674,
    5.363346,
    123.927794
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 12235730.36169017,
  "diameterKm": 104.0,
  "uncertaintyKm": 4.0,
  "lambda": 108.0,
  "beta": 44.0,
  "periodHours": 13.58364,
  "name": "Isis",
  "modelVersion": "2017-09-21"
};

test("Isis preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("isis", independentExpected));
