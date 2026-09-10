import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 3659,
  "shapeSha256": "461086209e88b1043b79cc9e64ca58de488f781dec10fa938a0d7cc68dcb6dc4",
  "vertices": 574,
  "faces": 1144,
  "firstVertex": [
    0.380446,
    -0.149895,
    0.442047
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000106673672,
  "diameterKm": 133.43,
  "uncertaintyKm": 2.06,
  "lambda": 217.0,
  "beta": -39.0,
  "periodHours": 5.73561,
  "name": "Dido",
  "modelVersion": "2019-05-07"
};

test("Dido preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("dido", independentExpected));
