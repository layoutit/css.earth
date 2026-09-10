import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 5924,
  "shapeSha256": "aa9daa8b781ee63a11e7a9efe3519ced4c1582ba90c9be3fd366ebaa6e177e76",
  "vertices": 578,
  "faces": 1152,
  "firstVertex": [
    0.002907,
    -0.00696,
    35.739547
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 423136.4387843295,
  "diameterKm": 93.0,
  "uncertaintyKm": 3.0,
  "lambda": 121.0,
  "beta": -27.0,
  "periodHours": 9.29759,
  "name": "Ausonia",
  "modelVersion": "2021-11-12"
};

test("Ausonia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("ausonia", independentExpected));
