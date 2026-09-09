import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1207,
  "shapeSha256": "ea6b5ad9251b69d29f43920366432979c8dc19158a1af0beb5560bbbc0f09d9a",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.191696,
    -0.07563,
    0.568221
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999390855049,
  "diameterKm": 150.24,
  "uncertaintyKm": 1.66,
  "lambda": 103.0,
  "beta": -22.0,
  "periodHours": 12.0948,
  "name": "Eukrate",
  "modelVersion": "2016-01-04"
};

test("Eukrate preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("eukrate", independentExpected));
