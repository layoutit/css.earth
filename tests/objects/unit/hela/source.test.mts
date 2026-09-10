import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 454,
  "shapeSha256": "722e4c9fad0c1b885eca9329149668e8397b4380ff0c96100c014c03fad8d77a",
  "vertices": 1586,
  "faces": 3168,
  "firstVertex": [
    0.000248,
    0.021159,
    0.408901
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000237186308,
  "diameterKm": 13.39,
  "uncertaintyKm": 0.45,
  "lambda": 45,
  "beta": 44,
  "periodHours": 3.396232,
  "name": "Hela",
  "modelVersion": "2012-07-30"
};

test("Hela preserves its source model and approximate raster scale", () => assertCalibratedAsteroidSource("hela", independentExpected));
