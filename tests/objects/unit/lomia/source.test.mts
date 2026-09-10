import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mts';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 838,
  "shapeSha256": "9269270e3faf2394d48a7f1711bb68c161039e38109c09c0e92e6e92140f3d85",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.33964,
    0.327974,
    0.440485
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000073550754,
  "diameterKm": 144.92,
  "uncertaintyKm": 1.86,
  "lambda": 117.0,
  "beta": -19.0,
  "periodHours": 9.12417,
  "name": "Lomia",
  "modelVersion": "2016-01-04"
};

test("Lomia preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("lomia", independentExpected));
