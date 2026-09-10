import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 444,
  "shapeSha256": "641a0c871a4f30afcfb42761be86fd53ef4a6c72566c5ad87e3a6e3dbf5a1923",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    -0.046832,
    0.137018,
    0.405702
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000380963694,
  "diameterKm": 114.19,
  "uncertaintyKm": 1.52,
  "lambda": 98.0,
  "beta": -60.0,
  "periodHours": 12.79953,
  "name": "Johanna",
  "modelVersion": "2012-07-30"
};

test("Johanna preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("johanna", independentExpected));
