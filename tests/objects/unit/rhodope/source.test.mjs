import {test} from 'node:test';
import {assertCalibratedAsteroidSource} from '../asteroid-calibration-contract.mjs';

// Original publisher-coordinate anchors and independent signed-volume intake.
const independentExpected = {
  "modelId": 619,
  "shapeSha256": "dae8593e45bf9983934225c5d78355e71944cbfb2c023b762170ca7683b1f441",
  "vertices": 1022,
  "faces": 2040,
  "firstVertex": [
    0.046448,
    -0.102689,
    0.62579
  ],
  "firstFace": [
    1,
    2,
    3
  ],
  "signedVolume": 1.000000034331226,
  "diameterKm": 53.26,
  "uncertaintyKm": 0.62,
  "lambda": 173.0,
  "beta": -3.0,
  "periodHours": 4.714799,
  "name": "Rhodope",
  "modelVersion": "2013-02-11"
};

test("Rhodope preserves its source model and calibrated raster triangles", () => assertCalibratedAsteroidSource("rhodope", independentExpected));
