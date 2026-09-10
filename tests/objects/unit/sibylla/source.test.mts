import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 6009,
  "shapeSha256": "f156336a2048015bfabaf6dc2be0d5a06683cdce4662d02c7e71931b33bbbb79",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.114645,
    0.111754,
    0.605015
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.00000006371333,
  "diameterKm": 146.48,
  "uncertaintyKm": 1.74,
  "lambda": 108.0,
  "beta": -62.0,
  "periodHours": 47.015,
  "name": "Sibylla",
  "modelVersion": "2022-02-14"
};

test("Sibylla preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("sibylla", independentExpected));
