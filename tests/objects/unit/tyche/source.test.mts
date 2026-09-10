import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 329,
  "shapeSha256": "0490bad5885c440c58b587c2bf6d2dd5b342afc976fb35ffbbe3dc0eac00f090",
  "vertices": 1016,
  "faces": 2028,
  "firstVertex": [
    0.239889,
    0.266705,
    0.470147
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999645722949,
  "diameterKm": 64.37,
  "uncertaintyKm": 0.89,
  "lambda": 224.0,
  "beta": -4.0,
  "periodHours": 10.04008,
  "name": "Tyche",
  "modelVersion": "2011-04-21"
};

test("Tyche preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("tyche", independentExpected));
