import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 797,
  "shapeSha256": "f1d26036f42cd12a1a45edb1d953d4b064b85c83474b898368bfde1a6b5ac7cc",
  "vertices": 994,
  "faces": 1984,
  "firstVertex": [
    0.431942,
    0.379222,
    0.462676
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999998167029801,
  "diameterKm": 126.5,
  "uncertaintyKm": 1.86,
  "lambda": 112.0,
  "beta": 2.0,
  "periodHours": 8.98059,
  "name": "Klymene",
  "modelVersion": "2016-01-04"
};

test("Klymene preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("klymene", independentExpected));
