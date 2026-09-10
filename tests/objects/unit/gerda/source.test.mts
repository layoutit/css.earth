import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 968,
  "shapeSha256": "d0b4a2670b3b5be50f4ea2a72901937964545ef598a904c82ba6b06d2e4c37cc",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.199075,
    0.223437,
    0.617603
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999285121318,
  "diameterKm": 85.41,
  "uncertaintyKm": 1.23,
  "lambda": 23.0,
  "beta": 20.0,
  "periodHours": 10.68724,
  "name": "Gerda",
  "modelVersion": "2016-01-04"
};

test("Gerda preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("gerda", independentExpected));
