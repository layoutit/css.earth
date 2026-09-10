import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5983,
  "shapeSha256": "a692afa2b908756462c3ecacb063c11f0c5ebed62afcab6936510f7b92421240",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.252814,
    0.086849,
    0.54473
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.0000000000471554,
  "diameterKm": 143.77,
  "uncertaintyKm": 2.51,
  "lambda": 173.0,
  "beta": -7.0,
  "periodHours": 25.6733,
  "name": "Meliboea",
  "modelVersion": "2022-02-14"
};

test("Meliboea preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("meliboea", independentExpected));
