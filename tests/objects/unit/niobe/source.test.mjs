import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 1014,
  "shapeSha256": "8b8480da8e3b48bf4e1a93f8e3ae2de0a69315a13dc947a105fe05a0c169338d",
  "vertices": 1018,
  "faces": 2032,
  "firstVertex": [
    0.199047,
    0.085001,
    0.559548
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999361593085,
  "diameterKm": 80.86,
  "uncertaintyKm": 0.8,
  "lambda": 88.0,
  "beta": -33.0,
  "periodHours": 35.8521,
  "name": "Niobe",
  "modelVersion": "2016-01-04"
};

test("Niobe preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("niobe", independentExpected));
