import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5913,
  "shapeSha256": "b6b64c30f487bfb7f146122cf99b49143693e622f2f182bcf5d80b44adc73564",
  "vertices": 1766,
  "faces": 3528,
  "firstVertex": [
    -3.311404,
    9.253699,
    59.116613
  ],
  "firstFace": [
    591,
    199,
    596
  ],
  "signedVolume": 1574200.8917261746,
  "diameterKm": 144.0,
  "uncertaintyKm": 3.0,
  "lambda": 28.0,
  "beta": -17.0,
  "periodHours": 6.110939,
  "name": "Ino",
  "modelVersion": "2021-11-12"
};

test("Ino preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ino", independentExpected));
