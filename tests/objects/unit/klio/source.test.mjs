import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5792,
  "shapeSha256": "470fb94f84bd323b2b698252ff223a2bf7cd2cd4b30c7c996141135c18ec8cfb",
  "vertices": 570,
  "faces": 1136,
  "firstVertex": [
    0.099256,
    0.357168,
    0.497743
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998475820483,
  "diameterKm": 78.32,
  "uncertaintyKm": 0.96,
  "lambda": 356.0,
  "beta": -53.0,
  "periodHours": 23.575,
  "name": "Klio",
  "modelVersion": "2019-10-23"
};

test("Klio preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("klio", independentExpected));
