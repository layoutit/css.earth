import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1732,
  "shapeSha256": "c93cad2380849e859383f912f5f1ef6042c6be167151571b7dc9a27f261165b6",
  "vertices": 1014,
  "faces": 2024,
  "firstVertex": [
    0.404893,
    0.039973,
    0.424896
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999544477837,
  "diameterKm": 101.9,
  "uncertaintyKm": 1.03,
  "lambda": 349.0,
  "beta": 8.0,
  "periodHours": 9.03506,
  "name": "Kalypso",
  "modelVersion": "2016-07-07"
};

test("Kalypso preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("kalypso", independentExpected));
