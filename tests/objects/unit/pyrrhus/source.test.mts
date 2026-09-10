import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 4373,
  "shapeSha256": "f48628b4019c5f747601fc0b9b289dd0ff7f53eaa8251cd5b762d2763069d0f0",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    -0.024159,
    -0.210889,
    0.644061
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000001562434626,
  "diameterKm": 48.356,
  "uncertaintyKm": 0.423,
  "lambda": 332.0,
  "beta": -12.0,
  "periodHours": 7.31916,
  "name": "Pyrrhus",
  "modelVersion": "2019-05-07"
};

test("Pyrrhus preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("pyrrhus", independentExpected));
