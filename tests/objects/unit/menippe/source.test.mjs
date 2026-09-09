import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 327,
  "shapeSha256": "6edbc9d49a54ef72199ed7da9d5827c133f1aa1c2170e2ee8c65e747454c8077",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.054842,
    0.217722,
    0.570278
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000121974248,
  "diameterKm": 35.3,
  "uncertaintyKm": 0.9,
  "lambda": 32.0,
  "beta": 48.0,
  "periodHours": 11.97647,
  "name": "Menippe",
  "modelVersion": "2011-04-21"
};

test("Menippe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("menippe", independentExpected));
