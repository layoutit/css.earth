import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1851,
  "shapeSha256": "45131587f308d1c0ec3565e7bd74c6bb7b0875bca028d847bc2a57c8a338648e",
  "vertices": 402,
  "faces": 800,
  "firstVertex": [
    -3.256883,
    -2.481648,
    45.163754
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 824677.6902846862,
  "diameterKm": 116.0,
  "uncertaintyKm": 5.0,
  "lambda": 103.0,
  "beta": -28.0,
  "periodHours": 18.14817,
  "name": "Melete",
  "modelVersion": "2017-09-21"
};

test("Melete preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("melete", independentExpected));
