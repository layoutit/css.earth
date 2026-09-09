import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 920,
  "shapeSha256": "6ee6620929ec650a72d7f2133a74f796fd91c07e8b3e24463808f878170adab2",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.312586,
    -0.101379,
    0.511674
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 0.9999999122153254,
  "diameterKm": 39.21,
  "uncertaintyKm": 0.97,
  "lambda": 356.0,
  "beta": 53.0,
  "periodHours": 7.95879,
  "name": "Scylla",
  "modelVersion": "2016-01-04"
};

test("Scylla preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("scylla", independentExpected));
