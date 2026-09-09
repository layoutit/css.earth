import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5017,
  "shapeSha256": "3212a810d5ca2f09b46bdac82d0817c197955b84313426df41f473fc6f7945fe",
  "vertices": 994,
  "faces": 1984,
  "firstVertex": [
    -0.859148,
    10.30857,
    39.719421
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 333038.14017642365,
  "diameterKm": 86.0,
  "uncertaintyKm": 13.0,
  "lambda": 31.0,
  "beta": 13.0,
  "periodHours": 15.3612,
  "name": "Iclea",
  "modelVersion": "2023-10-03"
};

test("Iclea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("iclea", independentExpected));
