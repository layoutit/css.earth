import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 319,
  "shapeSha256": "cbe8efe6448bf2e9ba29a52ca5f60b47f50d301f8f77c9610cf3d8ea63cf01c9",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -6.518471,
    12.261634,
    46.030434
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 678075.6020352487,
  "diameterKm": 109.0,
  "uncertaintyKm": 11.0,
  "lambda": 250.0,
  "beta": 17.0,
  "periodHours": 5.65534,
  "name": "Hesperia",
  "modelVersion": "2011-04-21"
};

test("Hesperia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("hesperia", independentExpected));
