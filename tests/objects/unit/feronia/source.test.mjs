import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1853,
  "shapeSha256": "d8096c0152a3739961254f1d3b305b3c6da0ad42d80ce7fc073cb63702a40bcc",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -2.458903,
    -0.619088,
    45.15898
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 427472.7343481016,
  "diameterKm": 93.0,
  "uncertaintyKm": 10.0,
  "lambda": 98.0,
  "beta": -52.0,
  "periodHours": 8.09068,
  "name": "Feronia",
  "modelVersion": "2017-09-21"
};

test("Feronia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("feronia", independentExpected));
