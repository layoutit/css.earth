import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 146,
  "shapeSha256": "b1248125111cb430f90a711830816a8132f7fed1682bbebab7e10ee127af24d5",
  "vertices": 1020,
  "faces": 2036,
  "firstVertex": [
    0.152736,
    0.109561,
    0.702907
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998770391936,
  "diameterKm": 58.6,
  "uncertaintyKm": 1.2,
  "lambda": 164.0,
  "beta": -28.0,
  "periodHours": 13.00079,
  "name": "Alkmene",
  "modelVersion": "2011-04-19"
};

test("Alkmene preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("alkmene", independentExpected));
