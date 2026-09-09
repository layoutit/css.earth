import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5976,
  "shapeSha256": "3878aec42eda2f64254bc260a3c0497632f037da3e447fd65082822521883492",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.018006,
    0.269113,
    0.468353
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000688872217,
  "diameterKm": 100.42,
  "uncertaintyKm": 1.33,
  "lambda": 100.0,
  "beta": 35.0,
  "periodHours": 17.1893,
  "name": "Sophrosyne",
  "modelVersion": "2022-02-14"
};

test("Sophrosyne preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("sophrosyne", independentExpected));
