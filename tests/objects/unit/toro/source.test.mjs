import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1862,
  "shapeSha256": "37dcd0f6ee31357b06abbd911720dcc46f36b7dd28bd1449a29a202c7dc8c373",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.468921,
    -0.070505,
    1.573095
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 22.44929757052581,
  "diameterKm": 3.5,
  "uncertaintyKm": 0.4,
  "lambda": 71.0,
  "beta": -69.0,
  "periodHours": 10.19782,
  "name": "Toro",
  "modelVersion": "2017-11-21"
};

test("Toro preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("toro", independentExpected));
