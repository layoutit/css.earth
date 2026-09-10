import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 296,
  "shapeSha256": "5953c0a8528106a185d0da899f40a1ef7bfe63457888c10ffa3062affe29eaa7",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    3.738434,
    17.618347,
    12.069276
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 41629.77705097848,
  "diameterKm": 43.0,
  "uncertaintyKm": 4.0,
  "lambda": 28.0,
  "beta": -72.0,
  "periodHours": 14.4767,
  "name": "Clarissa",
  "modelVersion": "2011-02-17"
};

test("Clarissa preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("clarissa", independentExpected));
