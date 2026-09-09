import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1859,
  "shapeSha256": "69317058f905f986f877add7e2e51a6ff8c3870852a334e4551d8cfd0311a5a2",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    5.507804,
    0.387291,
    57.731355
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1674280.6278942444,
  "diameterKm": 147.0,
  "uncertaintyKm": 14.0,
  "lambda": 257.0,
  "beta": 23.0,
  "periodHours": 6.895226,
  "name": "Emma",
  "modelVersion": "2017-09-21"
};

test("Emma preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("emma", independentExpected));
