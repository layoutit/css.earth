import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1912,
  "shapeSha256": "15e30ddcead93addfefb8473a689b601d549eab3710abf227abce3b7761d2be4",
  "vertices": 554,
  "faces": 1104,
  "firstVertex": [
    -0.046658,
    0.502842,
    0.504777
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000727612957,
  "diameterKm": 67.67,
  "uncertaintyKm": 0.82,
  "lambda": 121.0,
  "beta": 46.0,
  "periodHours": 10.8619,
  "name": "Clementina",
  "modelVersion": "2018-07-18"
};

test("Clementina preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("clementina", independentExpected));
